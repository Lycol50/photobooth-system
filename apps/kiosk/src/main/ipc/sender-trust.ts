import { AppError } from '../errors.js';

export function assertTrustedIpcSender(
  senderUrl: string | null,
  isMainFrame: boolean,
  expectedOrigin: string,
): void {
  if (!senderUrl || !isMainFrame) {
    throw new AppError('forbidden', 'The request source is not allowed.');
  }
  let sender: URL;
  try {
    sender = new URL(senderUrl);
  } catch {
    throw new AppError('forbidden', 'The request source is not allowed.');
  }
  const trusted =
    expectedOrigin === 'app://grace-booth'
      ? sender.protocol === 'app:' && sender.hostname === 'grace-booth'
      : sender.origin === expectedOrigin;
  if (!trusted) throw new AppError('forbidden', 'The request source is not allowed.');
}
