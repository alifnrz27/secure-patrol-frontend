function required(name: string, value: string | undefined): string {
  if (!value) {
    // Surfaced on the login screen instead of crashing the whole app.
    console.error(`Missing environment variable ${name}`);
    return '';
  }
  return value;
}

export const env = {
  apiBaseUrl: required('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, ''),
  appId: required('VITE_APP_ID', import.meta.env.VITE_APP_ID),
  appKey: required('VITE_APP_KEY', import.meta.env.VITE_APP_KEY),
};

export const isEnvConfigured = Boolean(env.apiBaseUrl && env.appId && env.appKey);
