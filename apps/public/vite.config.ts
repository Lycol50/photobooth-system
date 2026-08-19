import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

type ValidatedBuildEnvironment = {
  apiUrl: URL;
  pageOrigin: string;
};

const INERT_API_URL = 'https://unconfigured.invalid/functions/v1/photo';
const INERT_PAGE_ORIGIN = 'https://unconfigured.invalid';

function parseHttpsUrl(value: string, name: string, allowLocalHttp = true): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }
  const local = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  if (
    (parsed.protocol !== 'https:' && !(allowLocalHttp && local && parsed.protocol === 'http:')) ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(`${name} must use HTTPS without embedded credentials`);
  }
  return parsed;
}

function validateEnvironment(mode: string): ValidatedBuildEnvironment {
  const env = loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), 'VITE_');
  const testing = mode === 'test';
  const apiValue =
    env.VITE_PUBLIC_PHOTO_API_URL ??
    (testing ? 'https://api.example.test/functions/v1/photo' : INERT_API_URL);
  const pageValue =
    env.VITE_PUBLIC_PAGE_ORIGIN ?? (testing ? 'https://photos.example.test' : INERT_PAGE_ORIGIN);

  const apiUrl = parseHttpsUrl(apiValue, 'VITE_PUBLIC_PHOTO_API_URL');
  if (
    apiUrl.search ||
    apiUrl.hash ||
    apiUrl.pathname.replace(/\/+$/u, '') !== '/functions/v1/photo'
  ) {
    throw new Error('VITE_PUBLIC_PHOTO_API_URL must end with /functions/v1/photo');
  }
  apiUrl.pathname = apiUrl.pathname.replace(/\/+$/u, '');

  const pageUrl = parseHttpsUrl(pageValue, 'VITE_PUBLIC_PAGE_ORIGIN');
  if (pageUrl.pathname !== '/' || pageUrl.search || pageUrl.hash) {
    throw new Error('VITE_PUBLIC_PAGE_ORIGIN must contain only an origin');
  }

  return { apiUrl, pageOrigin: pageUrl.origin };
}

function securityTemplatePlugin(environment: ValidatedBuildEnvironment): Plugin {
  return {
    name: 'grace-booth-security-template',
    transformIndexHtml(html) {
      const upgradeInsecureRequests =
        environment.apiUrl.protocol === 'https:' && environment.pageOrigin.startsWith('https://')
          ? 'upgrade-insecure-requests'
          : '';
      return html
        .replaceAll('__PHOTO_API_ORIGIN__', environment.apiUrl.origin)
        .replaceAll('__PUBLIC_PAGE_ORIGIN__', environment.pageOrigin)
        .replaceAll('__UPGRADE_INSECURE_REQUESTS__', upgradeInsecureRequests);
    },
  };
}

export default defineConfig(({ mode }) => {
  const environment = validateEnvironment(mode);
  return {
    plugins: [react(), securityTemplatePlugin(environment)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      target: 'es2022',
      assetsInlineLimit: 4096,
      reportCompressedSize: true,
    },
    server: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      clearMocks: true,
      restoreMocks: true,
    },
  };
});
