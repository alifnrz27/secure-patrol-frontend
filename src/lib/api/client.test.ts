// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, setAuthHandler } from './client';
import { resetClockForTests, serverNow } from './clock';
import { signRequest } from './signing';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: 'http://api.test', appId: 'sp_web_test', appKey: 'spk_TEST-ONLY-4pZt7Qm2Xv9Lr3Ks8Wd1Nf6Hy0Bc5Ja' },
  isEnvConfigured: true,
}));

type Call = { url: string; init: RequestInit & { headers: Record<string, string> } };

function reply(status: number, body: unknown, date?: Date) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (date) headers.set('date', date.toUTCString());
  return new Response(JSON.stringify(body), { status, headers });
}

const ok = (data: unknown) => reply(200, { meta: { message: 'ok', code: 200, status: 'success' }, data });
const unauthorized = (message: string, data: string, date?: Date) => reply(401, { meta: { message, code: 401, status: 'Error' }, data }, date);

let calls: Call[];
let queue: Response[];

beforeEach(() => {
  calls = [];
  queue = [];
  resetClockForTests();
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: Call['init']) => {
    calls.push({ url, init });
    return queue.shift() ?? ok(null);
  }));
  setAuthHandler({ getAccessToken: async () => 'token-1', handleUnauthorized: async () => false });
});

afterEach(() => {
  vi.unstubAllGlobals();
  setAuthHandler(null);
});

describe('apiFetch', () => {
  it('signs pathname + search exactly as sent and unwraps data', async () => {
    queue.push(ok({ id: 1 }));
    const data = await apiFetch<{ id: number }>('/users', { query: { page: 2, search: 'budi santoso', role_id: undefined } });
    expect(data).toEqual({ id: 1 });
    const { url, init } = calls[0]!;
    expect(url).toBe('http://api.test/api/v1/users?page=2&search=budi+santoso');
    const h = init.headers;
    expect(h['X-App-Id']).toBe('sp_web_test');
    expect(h.Authorization).toBe('Bearer token-1');
    expect(h['X-Signature']).toBe(
      signRequest({ method: 'GET', requestUri: '/api/v1/users?page=2&search=budi+santoso', timestamp: h['X-Timestamp']!, nonce: h['X-Nonce']!, body: new Uint8Array(0), appKey: 'spk_TEST-ONLY-4pZt7Qm2Xv9Lr3Ks8Wd1Nf6Hy0Bc5Ja' }),
    );
  });

  it('signs the exact multipart bytes it sends', async () => {
    const form = new FormData();
    form.append('name', 'Budi');
    form.append('face_photo', new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }), 'f.jpg');
    await apiFetch('/users', { method: 'POST', form });
    const { init } = calls[0]!;
    const sent = init.body as Uint8Array;
    expect(init.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(init.headers['X-Signature']).toBe(
      signRequest({ method: 'POST', requestUri: '/api/v1/users', timestamp: init.headers['X-Timestamp']!, nonce: init.headers['X-Nonce']!, body: sent, appKey: 'spk_TEST-ONLY-4pZt7Qm2Xv9Lr3Ks8Wd1Nf6Hy0Bc5Ja' }),
    );
  });

  it('corrects the clock from the Date header and retries once on a timestamp error', async () => {
    const serverTime = new Date(Date.now() + 10 * 60_000);
    queue.push(unauthorized('Unauthorized app', 'request timestamp is invalid or outside the allowed window', serverTime), ok('done'));
    await expect(apiFetch('/auth/me')).resolves.toBe('done');
    expect(calls).toHaveLength(2);
    const retryTs = Number(calls[1]!.init.headers['X-Timestamp']) * 1000;
    expect(Math.abs(retryTs - serverTime.getTime())).toBeLessThan(3000);
    expect(Math.abs(serverNow() - serverTime.getTime())).toBeLessThan(3000);
  });

  it('retries with a new nonce when the nonce was reused', async () => {
    queue.push(unauthorized('Unauthorized app', 'request nonce has already been used'), ok('done'));
    await expect(apiFetch('/auth/me')).resolves.toBe('done');
    expect(calls[1]!.init.headers['X-Nonce']).not.toBe(calls[0]!.init.headers['X-Nonce']);
  });

  it('treats other app errors as configuration problems, without touching the session', async () => {
    const handleUnauthorized = vi.fn(async () => true);
    setAuthHandler({ getAccessToken: async () => 'token-1', handleUnauthorized });
    queue.push(unauthorized('Unauthorized app', 'request signature is invalid'));
    await expect(apiFetch('/auth/me')).rejects.toMatchObject({ kind: 'app' });
    expect(handleUnauthorized).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it('refreshes on "Token is expired" and retries with the new token', async () => {
    let token = 'old';
    setAuthHandler({
      getAccessToken: async () => token,
      handleUnauthorized: async (used) => {
        expect(used).toBe('old');
        token = 'new';
        return true;
      },
    });
    queue.push(unauthorized('Unauthorized', 'Token is expired'), ok('done'));
    await expect(apiFetch('/patrol-groups/current')).resolves.toBe('done');
    expect(calls[1]!.init.headers.Authorization).toBe('Bearer new');
  });

  it('gives up after one failed refresh', async () => {
    queue.push(unauthorized('Unauthorized', 'Token is invalid'));
    await expect(apiFetch('/auth/me')).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
    expect(calls).toHaveLength(1);
  });

  it('maps network failures to kind "network"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    await expect(apiFetch('/auth/me')).rejects.toMatchObject({ kind: 'network', status: 0 });
  });
});
