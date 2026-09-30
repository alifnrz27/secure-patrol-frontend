/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/**
 * Content Security Policy for the built app. The same value should be sent by
 * the production web server (see README). Styles need 'unsafe-inline' because
 * Mantine and Leaflet set inline style attributes.
 */
export function contentSecurityPolicy(apiBaseUrl: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://tile.openstreetmap.org",
    `connect-src 'self' ${apiBaseUrl}`.trim(),
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Optional: DEV_API_PROXY=http://127.0.0.1:3010 with an empty VITE_API_BASE_URL
    // mirrors the Docker setup (same origin, /api and /health proxied unchanged).
    proxy: process.env.DEV_API_PROXY
      ? { '/api': { target: process.env.DEV_API_PROXY }, '/health': { target: process.env.DEV_API_PROXY } }
      : undefined,
  },
  preview: {
    port: 4173,
    headers: {
      'Content-Security-Policy': contentSecurityPolicy(env.VITE_API_BASE_URL ?? ''),
      // OSM tiles are refused without a Referer; send only the origin cross-site.
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('leaflet')) return 'map';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('@mantine')) return 'mantine';
          if (/react-markdown|remark|micromark|mdast|unified|hast/.test(id)) return 'markdown';
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
  };
});
