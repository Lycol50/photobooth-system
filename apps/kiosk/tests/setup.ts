import '@testing-library/jest-dom/vitest';

import { createElement } from 'react';
import { vi } from 'vitest';

vi.mock('lottie-react', () => ({
  LottieLight: ({ src }: { src: string | object }) =>
    createElement('div', {
      'data-testid': 'lottie-renderer',
      'data-src': typeof src === 'string' ? src : 'inline',
    }),
}));
