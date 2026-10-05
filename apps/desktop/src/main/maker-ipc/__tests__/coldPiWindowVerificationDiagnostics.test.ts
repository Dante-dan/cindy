import { describe, expect, it } from 'vitest';
import {
  ColdPiWindowVerificationError,
  coldPiWindowVerificationFailureReason,
  withColdPiWindowVerificationStage,
  type ColdPiWindowVerificationFailureReason,
} from '../coldPiWindowVerificationDiagnostics.js';

describe('cold Pi window verification diagnostics', () => {
  it('returns successful work unchanged', async () => {
    const runtime = { verified: true };
    await expect(
      withColdPiWindowVerificationStage('bootstrap-failed', async () => runtime),
    ).resolves.toBe(runtime);
  });

  it.each<ColdPiWindowVerificationFailureReason>([
    'session-read-failed',
    'session-missing',
    'not-pi',
    'remote-runtime',
    'native-session-missing',
    'working-directory-missing',
    'working-directory-check-failed',
    'bootstrap-preparation-failed',
    'bootstrap-failed',
  ])('reports only the fixed category %s, without leaking an underlying error', async (reason) => {
    const privateError = new Error(
      'private-session-id /private/path token=secret conversation text',
    );
    try {
      await withColdPiWindowVerificationStage(reason, async () => {
        throw privateError;
      });
      expect.unreachable('a failed verification must remain rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(ColdPiWindowVerificationError);
      expect(coldPiWindowVerificationFailureReason(error)).toBe(reason);
      expect((error as Error).message).toBe(reason);
      expect((error as Error).cause).toBeUndefined();
      expect(JSON.stringify(error)).not.toContain('secret');
    }
  });

  it('keeps synchronous and interrupted bootstrap failures rejected', async () => {
    await expect(
      withColdPiWindowVerificationStage('bootstrap-failed', () => {
        throw Object.assign(new Error('private interrupted startup'), { name: 'AbortError' });
      }),
    ).rejects.toMatchObject({ reason: 'bootstrap-failed' });
  });

  it('does not accept arbitrary external reason fields or error messages', () => {
    expect(coldPiWindowVerificationFailureReason({ reason: 'private contents' })).toBe('unknown');
    expect(coldPiWindowVerificationFailureReason(new Error('private contents'))).toBe('unknown');
    expect(coldPiWindowVerificationFailureReason(null)).toBe('unknown');
  });
});
