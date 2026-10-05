/** Public-safe categories; never return the underlying bootstrap error or session data. */
export type ColdPiWindowVerificationFailureReason =
  | 'session-read-failed'
  | 'session-missing'
  | 'not-pi'
  | 'remote-runtime'
  | 'native-session-missing'
  | 'working-directory-missing'
  | 'working-directory-check-failed'
  | 'bootstrap-preparation-failed'
  | 'bootstrap-failed';

export class ColdPiWindowVerificationError extends Error {
  constructor(readonly reason: ColdPiWindowVerificationFailureReason) {
    super(reason);
    this.name = 'ColdPiWindowVerificationError';
  }
}

export async function withColdPiWindowVerificationStage<T>(
  reason: ColdPiWindowVerificationFailureReason,
  action: () => PromiseLike<T>,
): Promise<T> {
  try {
    return await action();
  } catch {
    // Do not retain a cause: serializing it can expose native-session contents or local paths.
    throw new ColdPiWindowVerificationError(reason);
  }
}

export function coldPiWindowVerificationFailureReason(
  error: unknown,
): ColdPiWindowVerificationFailureReason | 'unknown' {
  return error instanceof ColdPiWindowVerificationError ? error.reason : 'unknown';
}
