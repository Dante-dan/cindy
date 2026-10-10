import { parseFsWatchTopic } from '@cindy/device-link';
import { getSessionFsSnapshot } from '../localDb/ipc/sessions.js';
import { normalizeWorkingDirForStorage } from '../../shared/workingDir.js';
import type { SharedTaskPeerCapture } from './sharedTaskDispatch.js';

function deny(): never { throw new Error('[PERMISSION_DENIED] Working directory does not belong to this shared task'); }

/** The task workdir as recorded on this host; guest-supplied paths are only compared to it. */
async function sharedTaskWorkdir(capture: SharedTaskPeerCapture): Promise<{ workingDir: string; remoteHostId: string | null } | null> {
  const snapshot = await getSessionFsSnapshot(capture.author.sessionId);
  const workingDir = normalizeWorkingDirForStorage(snapshot?.workingDir);
  return snapshot && workingDir ? { workingDir, remoteHostId: snapshot.remoteHostId } : null;
}

/**
 * Run before any file access for a shared-task guest: the requested workdir
 * must be this task's own workdir, and membership is rechecked after the DB read.
 * Returns the task's SSH host so the caller can refuse a different endpoint.
 */
export async function assertSharedTaskWorkdir(
  capture: SharedTaskPeerCapture, workdir: string, operation: 'file.read' | 'file.write',
): Promise<{ remoteHostId: string | null }> {
  if (!capture.isCurrent() || !capture.authorize(operation)) deny();
  const own = await sharedTaskWorkdir(capture);
  if (!own || normalizeWorkingDirForStorage(workdir) !== own.workingDir ||
      !capture.isCurrent() || !capture.authorize(operation)) deny();
  return { remoteHostId: own.remoteHostId };
}

/**
 * Admit fs-watch topics only for this task's workdir. Mismatches are dropped
 * rather than failing the frame: reconnect replay merges them with the task
 * stream, which must keep working if the watch is no longer valid.
 */
export async function admitSharedTaskFsWatchTopics(
  capture: SharedTaskPeerCapture, topics: readonly unknown[],
): Promise<{ topics: unknown[]; verified: Set<string> }> {
  const watched = topics.filter((topic) => typeof topic === 'string' && parseFsWatchTopic(topic) !== null);
  if (watched.length === 0) return { topics: [...topics], verified: new Set() };
  const own = capture.isCurrent() && capture.authorize('file.read') ? await sharedTaskWorkdir(capture) : null;
  const verified = new Set<string>();
  if (own && capture.isCurrent()) {
    for (const topic of watched as string[]) {
      if (normalizeWorkingDirForStorage(parseFsWatchTopic(topic)) === own.workingDir) verified.add(topic);
    }
  }
  return { topics: topics.filter((topic) => !watched.includes(topic) || verified.has(topic as string)), verified };
}
