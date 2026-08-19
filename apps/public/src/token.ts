const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function tokenFromFragment(fragment: string): string | null {
  const candidate = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  return PUBLIC_TOKEN_PATTERN.test(candidate) ? candidate : null;
}
