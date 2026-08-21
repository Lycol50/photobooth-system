function parseConfiguredUrl(value: string | undefined, name: string): URL {
  const fallback =
    import.meta.env.MODE === 'test'
      ? name === 'VITE_PUBLIC_PHOTO_API_URL'
        ? 'https://api.example.test/functions/v1/photo'
        : 'https://photos.example.test'
      : name === 'VITE_PUBLIC_PHOTO_API_URL'
        ? 'https://unconfigured.invalid/functions/v1/photo'
        : 'https://unconfigured.invalid';
  let url: URL;
  try {
    url = new URL(value ?? fallback);
  } catch {
    throw new Error(`${name} is not configured`);
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${name} is invalid`);
  }
  return url;
}

function readEnvironmentValue(environment: unknown, name: string): string | undefined {
  if (!environment || typeof environment !== 'object') return undefined;
  const value = (environment as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

const runtimeEnvironment: unknown = import.meta.env;
const configuredApiUrl = readEnvironmentValue(runtimeEnvironment, 'VITE_PUBLIC_PHOTO_API_URL');
const configuredPageOrigin = readEnvironmentValue(runtimeEnvironment, 'VITE_PUBLIC_PAGE_ORIGIN');
const apiUrl = parseConfiguredUrl(configuredApiUrl, 'VITE_PUBLIC_PHOTO_API_URL');
if (apiUrl.pathname.replace(/\/+$/u, '') !== '/functions/v1/photo') {
  throw new Error('VITE_PUBLIC_PHOTO_API_URL is invalid');
}

const pageUrl = parseConfiguredUrl(configuredPageOrigin, 'VITE_PUBLIC_PAGE_ORIGIN');
if (pageUrl.pathname !== '/') {
  throw new Error('VITE_PUBLIC_PAGE_ORIGIN is invalid');
}

export const PHOTO_API_BASE_URL = apiUrl.toString().replace(/\/+$/u, '');
export const EXPECTED_PAGE_ORIGIN = pageUrl.origin;

export function isExpectedPageOrigin(): boolean {
  if (!import.meta.env.PROD) return true;
  if (window.location.origin === EXPECTED_PAGE_ORIGIN) return true;
  return (
    window.location.hostname.endsWith('.pages.dev') ||
    window.location.hostname.endsWith('.workers.dev')
  );
}
