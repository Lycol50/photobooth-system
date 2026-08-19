import { AppError } from '../errors.js';

export function assertOperatorBootstrapComplete(configured: boolean): void {
  if (!configured) {
    throw new AppError(
      'bootstrap_required',
      'An operator must create the local admin passcode before guest sessions can start.',
    );
  }
}
