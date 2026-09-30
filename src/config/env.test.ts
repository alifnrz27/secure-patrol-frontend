import { afterEach, describe, expect, it, vi } from 'vitest';

async function problemFor(apiBaseUrl: string, pageUrl: string) {
  vi.resetModules();
  vi.stubEnv('VITE_API_BASE_URL', apiBaseUrl);
  vi.stubEnv('VITE_APP_ID', 'sp_web_x');
  vi.stubEnv('VITE_APP_KEY', 'spk_x');
  vi.stubGlobal('location', new URL(pageUrl));
  const { apiConfigProblem } = await import('./env');
  return apiConfigProblem();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('apiConfigProblem', () => {
  it('accepts an empty base URL (same-origin proxy) and matching setups', async () => {
    expect(await problemFor('', 'http://10.0.0.5:9002/login')).toBeNull();
    expect(await problemFor('http://127.0.0.1:3010', 'http://localhost:5173/login')).toBeNull();
    expect(await problemFor('https://api.contoh.id', 'https://admin.contoh.id/login')).toBeNull();
  });

  it('flags a localhost API used from another machine', async () => {
    expect(await problemFor('http://127.0.0.1:9001', 'http://10.0.0.5:9002/login')).toMatch(/komputer pengguna sendiri/);
  });

  it('flags mixed content', async () => {
    expect(await problemFor('http://10.0.0.5:9001', 'https://admin.contoh.id/login')).toMatch(/HTTPS/);
  });
});
