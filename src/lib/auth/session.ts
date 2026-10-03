import { apiFetch, setAuthHandler, syncClockWithServer } from '@/lib/api/client';
import { serverNow } from '@/lib/api/clock';
import { ApiError, isApiError, LICENSE_INACTIVE, UNIT_INACTIVE, UNIT_OVER_LICENSE } from '@/lib/api/errors';
import { isLicenseLocked } from '@/lib/license';
import type { AppConfig, LicenseSummary, LoginUser, Profile, TokenResponse, User } from '@/lib/api/types';
import { hasPermission, SUPER_ADMIN_ROLE } from '@/lib/permissions';

// Session rules (backend docs/AUTH.md):
// - The access token lives only in memory.
// - The refresh token is kept in localStorage so a reload keeps the session.
// - A refresh token is single use; reusing an old one kills the whole session,
//   so refreshing is single-flight across tabs (Web Locks) and the result is
//   shared with other tabs (BroadcastChannel).

const REFRESH_TOKEN_KEY = 'sp.refresh_token';
const LOCK_NAME = 'sp-refresh';
const CHANNEL_NAME = 'sp-auth';
const PROACTIVE_REFRESH_MS = 60_000;
const PEER_TOKEN_WAIT_MS = 400;
const BROADCAST_WAIT_MS = 1500;

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';
export type SessionEndReason = 'expired' | 'logout' | 'forbidden' | 'unit_inactive' | 'license_inactive' | 'unit_over_license' | null;

/** Message of the error thrown when a role may not use the web admin (e.g. security_team). */
export const WEB_ACCESS_DENIED = 'this role is not allowed to use the web admin';

export interface SessionState {
  status: SessionStatus;
  user: User | null;
  config: AppConfig | null;
  /** License summary for the banner and the locked mode (null until known). */
  license: LicenseSummary | null;
  /** data: URL of the face photo from the login response; kept in memory only. */
  avatarDataUrl: string | null;
  endReason: SessionEndReason;
  /** Startup failed for a reason other than an invalid session (e.g. network). */
  bootError: ApiError | null;
}

type ChannelMessage =
  | { type: 'tokens'; accessToken: string; expiresAt: number; refreshToken: string; user?: User; config?: AppConfig; license?: LicenseSummary | null }
  | { type: 'token-request' }
  | { type: 'logout'; reason: SessionEndReason };

function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeRefreshToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Storage blocked: the session will simply not survive a reload.
  }
}

function withoutPhoto(user: LoginUser | User): User {
  const { face_photo_base64: _b, face_photo_mime_type: _m, ...rest } = user as LoginUser;
  return rest;
}

async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(LOCK_NAME, fn);
  }
  // Web Locks need a secure context (HTTPS/localhost). Without it only the
  // in-tab single-flight applies; see README.
  return fn();
}

class SessionManager {
  private state: SessionState = {
    status: 'loading',
    user: null,
    config: null,
    license: null,
    avatarDataUrl: null,
    endReason: null,
    bootError: null,
  };
  private listeners = new Set<() => void>();
  private accessToken: string | null = null;
  private expiresAt = 0;
  private refreshToken: string | null = null;
  private refreshInFlight: Promise<boolean> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private channel: BroadcastChannel | null = null;
  private tokenWaiters = new Set<() => void>();
  private started = false;

  // ---- external store ----

  getState = (): SessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  // ---- startup ----

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    setAuthHandler({
      getAccessToken: () => this.getAccessToken(),
      handleUnauthorized: (usedToken) => this.handleUnauthorized(usedToken),
      handleRevoked: (reason) => {
        if (this.state.status === 'unauthenticated') return;
        // A locked license keeps the Super-Admin signed in, on the License page only.
        if (reason === 'license_inactive' && this.state.user?.role.code === SUPER_ADMIN_ROLE) {
          if (!isLicenseLocked(this.state.license?.status)) void this.refreshProfile().catch(() => undefined);
          return;
        }
        this.end(reason);
      },
    });

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent<ChannelMessage>) => this.onChannelMessage(event.data);
    }

    await syncClockWithServer();
    await this.restore();
  }

  /** Restores the session after a reload or in a new tab. */
  async restore(): Promise<void> {
    this.setState({ status: 'loading', bootError: null });
    this.refreshToken = readRefreshToken();
    if (!this.refreshToken) {
      this.setState({ status: 'unauthenticated' });
      return;
    }

    try {
      // Another open tab may already hold a valid access token; asking for it
      // avoids spending a refresh token on every new tab.
      const fromPeer = await this.requestTokenFromPeers();
      if (!fromPeer && !(await this.refresh())) return;

      const [profile, config] = await Promise.all([
        apiFetch<Profile>('/auth/me'),
        apiFetch<AppConfig>('/app-config'),
      ]);
      const { license = null, ...user } = profile;
      if (!hasPermission(user.role.code, 'webAccess')) {
        await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
        this.end('forbidden');
        return;
      }
      this.setState({ status: 'authenticated', user, config, license, endReason: null, bootError: null });
    } catch (error) {
      if (isApiError(error) && (error.kind === 'network' || error.kind === 'server' || error.kind === 'app')) {
        this.setState({ status: 'loading', bootError: error });
        return;
      }
      if (this.state.status !== 'unauthenticated') this.end('expired');
    }
  }

  private requestTokenFromPeers(): Promise<boolean> {
    if (!this.channel) return Promise.resolve(false);
    return new Promise((resolve) => {
      const done = (ok: boolean) => {
        clearTimeout(timer);
        this.tokenWaiters.delete(onTokens);
        resolve(ok);
      };
      const onTokens = () => done(true);
      const timer = setTimeout(() => done(false), PEER_TOKEN_WAIT_MS);
      this.tokenWaiters.add(onTokens);
      this.post({ type: 'token-request' });
    });
  }

  // ---- tokens ----

  private hasFreshAccessToken(): boolean {
    return Boolean(this.accessToken) && serverNow() < this.expiresAt - 5_000;
  }

  async getAccessToken(): Promise<string | null> {
    if (this.hasFreshAccessToken()) return this.accessToken;
    if (!this.refreshToken && !readRefreshToken()) return null;
    try {
      await this.refresh();
    } catch {
      // Network problem: send the old token and let the 401 path decide.
    }
    return this.accessToken;
  }

  private async handleUnauthorized(usedToken: string): Promise<boolean> {
    // Another tab (or a parallel request) already replaced the token.
    if (this.accessToken && this.accessToken !== usedToken && this.hasFreshAccessToken()) return true;
    return this.refresh(usedToken);
  }

  /**
   * Single-flight refresh within this tab and, through Web Locks, across tabs.
   * Resolves false (and ends the session) when the refresh token is rejected;
   * rejects with ApiError on network/server errors so the session is kept.
   */
  refresh(staleAccessToken?: string): Promise<boolean> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.doRefresh(staleAccessToken).finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async doRefresh(staleAccessToken?: string): Promise<boolean> {
    const knownRefreshToken = this.refreshToken;
    const tokenBefore = staleAccessToken ?? this.accessToken;

    return withRefreshLock(async () => {
      const current = readRefreshToken();
      if (!current) {
        this.end('expired');
        return false;
      }

      if (current !== knownRefreshToken) {
        // Another tab refreshed while we waited for the lock. Its broadcast
        // carries the new access token; use that instead of refreshing again.
        if (this.refreshToken === current && this.accessToken !== tokenBefore && this.hasFreshAccessToken()) return true;
        if (await this.waitForBroadcast(current)) return true;
        // No broadcast arrived. `current` was written under this lock, so it is
        // the latest unused refresh token and is safe to use.
      }

      let tokens: TokenResponse;
      try {
        tokens = await apiFetch<TokenResponse>('/auth/refresh', {
          method: 'POST',
          json: { refresh_token: current },
          auth: false,
        });
      } catch (error) {
        if (isApiError(error) && (error.kind === 'unauthorized' || error.kind === 'validation' || error.kind === 'forbidden')) {
          this.end(
            error.mentions(UNIT_INACTIVE)
              ? 'unit_inactive'
              : error.mentions(LICENSE_INACTIVE)
                ? 'license_inactive'
                : error.mentions(UNIT_OVER_LICENSE)
                  ? 'unit_over_license'
                  : 'expired',
          );
          return false;
        }
        throw error;
      }

      this.applyTokens(tokens);
      writeRefreshToken(tokens.refresh_token);
      this.post({
        type: 'tokens',
        accessToken: tokens.access_token,
        expiresAt: this.expiresAt,
        refreshToken: tokens.refresh_token,
        user: withoutPhoto(tokens.user),
        config: tokens.config,
        license: tokens.license ?? null,
      });
      if (this.state.status === 'authenticated') {
        this.setState({ user: withoutPhoto(tokens.user), config: tokens.config, license: tokens.license ?? this.state.license });
      }
      return true;
    });
  }

  private waitForBroadcast(refreshToken: string): Promise<boolean> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.refreshToken === refreshToken && this.hasFreshAccessToken()) {
          clearTimeout(timer);
          this.tokenWaiters.delete(check);
          resolve(true);
        }
      };
      const timer = setTimeout(() => {
        this.tokenWaiters.delete(check);
        resolve(false);
      }, BROADCAST_WAIT_MS);
      this.tokenWaiters.add(check);
      check();
    });
  }

  private applyTokens(tokens: Pick<TokenResponse, 'access_token' | 'expires_at' | 'refresh_token'>): void {
    this.setTokens(tokens.access_token, Date.parse(tokens.expires_at), tokens.refresh_token);
  }

  private setTokens(accessToken: string, expiresAt: number, refreshToken: string): void {
    this.accessToken = accessToken;
    this.expiresAt = expiresAt;
    this.refreshToken = refreshToken;
    this.scheduleProactiveRefresh();
    this.tokenWaiters.forEach((w) => w());
  }

  private scheduleProactiveRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    if (!this.expiresAt) return;
    const delay = Math.max(this.expiresAt - PROACTIVE_REFRESH_MS - serverNow(), 1_000);
    this.refreshTimer = setTimeout(() => {
      this.refresh().catch(() => {
        // Offline: retry shortly; requests will also refresh reactively.
        this.refreshTimer = setTimeout(() => this.scheduleProactiveRefresh(), 15_000);
      });
    }, delay);
  }

  // ---- login / logout ----

  async login(email: string, password: string): Promise<void> {
    const tokens = await apiFetch<TokenResponse>('/auth/login', {
      method: 'POST',
      json: { email: email.trim(), password },
      auth: false,
    });
    if (!hasPermission(tokens.user.role.code, 'webAccess')) {
      await this.revokeUnusedSession(tokens.access_token);
      throw new ApiError(403, 'Forbidden', WEB_ACCESS_DENIED);
    }
    this.applyTokens(tokens);
    writeRefreshToken(tokens.refresh_token);
    const user = withoutPhoto(tokens.user);
    const { face_photo_base64: base64, face_photo_mime_type: mime } = tokens.user;
    this.post({ type: 'tokens', accessToken: tokens.access_token, expiresAt: this.expiresAt, refreshToken: tokens.refresh_token, user, config: tokens.config, license: tokens.license ?? null });
    this.setState({
      status: 'authenticated',
      user,
      config: tokens.config,
      license: tokens.license ?? null,
      avatarDataUrl: base64 && mime ? `data:${mime};base64,${base64}` : null,
      endReason: null,
      bootError: null,
    });
  }

  /**
   * Ends a session the server just created for a role that may not use the web
   * admin. Only the in-memory token is touched, never another tab's session.
   */
  private async revokeUnusedSession(accessToken: string): Promise<void> {
    const previous = { token: this.accessToken, expiresAt: this.expiresAt };
    this.accessToken = accessToken;
    this.expiresAt = serverNow() + 60_000;
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Best effort: the backend also blocks this role.
    } finally {
      this.accessToken = previous.token;
      this.expiresAt = previous.expiresAt;
    }
  }

  async logout(everywhere = false): Promise<void> {
    try {
      await apiFetch(everywhere ? '/auth/logout-all' : '/auth/logout', { method: 'POST' });
    } catch (error) {
      // logout-all must succeed to be meaningful; a local logout always proceeds.
      if (everywhere) throw error;
    }
    this.end('logout');
  }

  /** Reloads the app config (e.g. the location radius) after settings change. */
  async refreshConfig(): Promise<void> {
    const config = await apiFetch<AppConfig>('/app-config');
    if (this.state.status === 'authenticated') this.setState({ config });
  }

  /** Reloads profile and license summary (e.g. after installing a license). */
  async refreshProfile(): Promise<void> {
    const { license = null, ...user } = await apiFetch<Profile>('/auth/me');
    if (this.state.status === 'authenticated') this.setState({ user, license });
  }

  /** Updates the cached profile after the user edits it. */
  setUser(user: User): void {
    this.setState({ user });
  }

  /** Clears the session in this tab and tells other tabs. */
  end(reason: SessionEndReason, broadcast = true): void {
    this.accessToken = null;
    this.expiresAt = 0;
    this.refreshToken = null;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    writeRefreshToken(null);
    if (broadcast) this.post({ type: 'logout', reason });
    this.setState({ status: 'unauthenticated', user: null, config: null, license: null, avatarDataUrl: null, endReason: reason, bootError: null });
  }

  // ---- cross-tab ----

  private post(message: ChannelMessage): void {
    this.channel?.postMessage(message);
  }

  private onChannelMessage(message: ChannelMessage): void {
    switch (message.type) {
      case 'tokens': {
        this.setTokens(message.accessToken, message.expiresAt, message.refreshToken);
        if (this.state.status === 'authenticated') {
          this.setState({
            user: message.user ?? this.state.user,
            config: message.config ?? this.state.config,
            license: message.license !== undefined ? message.license : this.state.license,
          });
        } else if (this.state.status === 'unauthenticated' && message.user && message.config) {
          // Logged in from another tab.
          this.setState({ status: 'authenticated', user: message.user, config: message.config, license: message.license ?? null, endReason: null });
        }
        break;
      }
      case 'token-request': {
        if (this.state.status === 'authenticated' && this.accessToken && this.refreshToken && this.hasFreshAccessToken()) {
          this.post({ type: 'tokens', accessToken: this.accessToken, expiresAt: this.expiresAt, refreshToken: this.refreshToken });
        }
        break;
      }
      case 'logout': {
        if (this.state.status !== 'unauthenticated' || this.accessToken) this.end(message.reason, false);
        break;
      }
    }
  }
}

export const session = new SessionManager();
