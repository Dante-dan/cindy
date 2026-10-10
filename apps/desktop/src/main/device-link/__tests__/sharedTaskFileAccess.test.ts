import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharedTaskPeerCapture } from '../sharedTaskDispatch.js';

const snapshot = vi.hoisted(() => vi.fn());
vi.mock('../../localDb/ipc/sessions.js', () => ({ getSessionFsSnapshot: snapshot }));

import { admitSharedTaskFsWatchTopics, assertSharedTaskWorkdir } from '../sharedTaskFileAccess.js';

function capture(overrides: Partial<SharedTaskPeerCapture> = {}): SharedTaskPeerCapture {
  return {
    author: { sharedTaskId: 'shared', sessionId: 'task', memberId: 'member', accountId: 'guest', displayName: 'Guest' },
    isCurrent: () => true,
    authorize: () => true,
    ...overrides,
  };
}

beforeEach(() => {
  snapshot.mockReset();
  snapshot.mockResolvedValue({ workingDir: '/host/task', remoteHostId: null, permissionMode: 'default', planModeEnabled: false });
});

describe('shared task workdir binding', () => {
  it('accepts only the host-recorded task workdir and returns its endpoint', async () => {
    await expect(assertSharedTaskWorkdir(capture(), '/host/task', 'file.write')).resolves.toEqual({ remoteHostId: null });
    await expect(assertSharedTaskWorkdir(capture(), '/host/task/', 'file.read')).resolves.toEqual({ remoteHostId: null });
    await expect(assertSharedTaskWorkdir(capture(), '/host/other', 'file.read')).rejects.toThrow('PERMISSION_DENIED');
    await expect(assertSharedTaskWorkdir(capture(), '/host', 'file.read')).rejects.toThrow('PERMISSION_DENIED');
    expect(snapshot).toHaveBeenCalledWith('task');
    snapshot.mockResolvedValue({ workingDir: '/srv/task', remoteHostId: 'ssh-1', permissionMode: 'default', planModeEnabled: false });
    await expect(assertSharedTaskWorkdir(capture(), '/srv/task', 'file.read')).resolves.toEqual({ remoteHostId: 'ssh-1' });
  });

  it('fails closed without a workdir, without the operation, or when revoked during the lookup', async () => {
    snapshot.mockResolvedValueOnce(null);
    await expect(assertSharedTaskWorkdir(capture(), '/host/task', 'file.read')).rejects.toThrow('PERMISSION_DENIED');
    await expect(assertSharedTaskWorkdir(capture({ authorize: (op) => op !== 'file.write' }), '/host/task', 'file.write'))
      .rejects.toThrow('PERMISSION_DENIED');
    let current = true;
    snapshot.mockImplementationOnce(async () => {
      current = false;
      return { workingDir: '/host/task', remoteHostId: null };
    });
    await expect(assertSharedTaskWorkdir(capture({ isCurrent: () => current }), '/host/task', 'file.read'))
      .rejects.toThrow('PERMISSION_DENIED');
  });

  it('admits only the task workdir watch and keeps other topics for the synchronous gate', async () => {
    const admitted = await admitSharedTaskFsWatchTopics(capture(), ['session:task', 'fs-watch:/host/task', 'fs-watch:/host/other']);
    expect(admitted.topics).toEqual(['session:task', 'fs-watch:/host/task']);
    expect([...admitted.verified]).toEqual(['fs-watch:/host/task']);
    const denied = await admitSharedTaskFsWatchTopics(capture({ authorize: () => false }), ['session:task', 'fs-watch:/host/task']);
    expect(denied).toEqual({ topics: ['session:task'], verified: new Set() });
  });

  it('never looks up an oversized topic frame', async () => {
    snapshot.mockClear();
    const topics = Array.from({ length: 5000 }, (_, i) => `fs-watch:/host/task-${i}`);
    const admitted = await admitSharedTaskFsWatchTopics(capture(), topics);
    expect(admitted.verified.size).toBe(0);
    expect(snapshot).not.toHaveBeenCalled();
  });
});
