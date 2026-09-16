// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TabKindHostContext } from '../../../types';
import type { SessionTaskItem } from '../listSessionTasks';
import { BackgroundTasksBody } from '../BackgroundTasksBody';

const mocks = vi.hoisted(() => ({
  clearAttention: vi.fn(),
  focusTask: vi.fn(),
  sidebarWindow: false,
  items: [] as SessionTaskItem[],
  snapshot: { messages: [], taskUpdates: new Map(), isStreaming: false },
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/sessionAttentionStore', () => ({
  clearSystemSessionAttention: mocks.clearAttention,
}));
vi.mock('@/lib/sidebarWindow', () => ({ isSidebarWindow: () => mocks.sidebarWindow }));
vi.mock('@/features/device-link/remoteProjectsStore', () => ({
  getSessionDeviceId: () => 'remote-device',
  useRemoteDevices: () => [],
}));
vi.mock('@/lib/makerChatStore', () => ({
  EMPTY_TASK_UPDATES: new Map(),
  makerChatStore: {
    subscribe: () => () => {},
    getSnapshot: () => mocks.snapshot,
    enterView: () => () => {},
    ensureInitialMessages: vi.fn(),
  },
}));
vi.mock('@/lib/makerTransport', () => ({
  isRemoteSessionSticky: () => true,
  listSessionBackgroundTasksFor: async () => ({ tasks: [] }),
  getWorkflowProgressFor: async () => null,
}));
vi.mock('../listSessionTasks', () => ({
  listSessionTasks: () => ({ running: [], completed: mocks.items }),
}));
vi.mock('../chatTaskFocusIntent', () => ({ requestChatTaskFocus: mocks.focusTask }));
vi.mock('../WorkflowProgressTree', () => ({ WorkflowProgressTree: () => null }));

const ctx: TabKindHostContext = {
  tabId: 'background-tasks',
  sessionId: 'remote-session',
  workdir: '',
  remoteHostId: null,
  patchState: vi.fn(),
  onVisibilityChange: vi.fn(),
  setCloseInterceptor: () => () => {},
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sidebarWindow = false;
  mocks.items = [{
    key: 'task',
    kind: 'workflow',
    title: 'Completed task',
    status: 'completed',
    provider: 'claude-code',
    toolCallClientId: 'tool-call',
    orderIndex: 0,
  }];
});
afterEach(cleanup);

describe('background task row attention', () => {
  it('acknowledges the session explicitly when opening workflow details', () => {
    render(<BackgroundTasksBody state={{}} ctx={ctx} />);
    expect(mocks.clearAttention).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Completed task/ }));

    expect(mocks.clearAttention).toHaveBeenCalledExactlyOnceWith('remote-session', 'explicit');
    expect(screen.getByRole('button', { name: 'rightSidebar.backgroundTasks.back' })).toBeTruthy();
    expect(mocks.focusTask).not.toHaveBeenCalled();
  });

  it('acknowledges the session and preserves chat task focus', () => {
    mocks.items[0].kind = 'agent';
    render(<BackgroundTasksBody state={{}} ctx={ctx} />);

    fireEvent.click(screen.getByRole('button', { name: /Completed task/ }));

    expect(mocks.clearAttention).toHaveBeenCalledExactlyOnceWith('remote-session', 'explicit');
    expect(mocks.focusTask).toHaveBeenCalledExactlyOnceWith('remote-session', 'tool-call');
  });

  it('does not acknowledge non-actionable chat rows in a detached sidebar', () => {
    mocks.sidebarWindow = true;
    mocks.items[0].kind = 'agent';
    render(<BackgroundTasksBody state={{}} ctx={ctx} />);

    fireEvent.click(screen.getByRole('button', { name: /Completed task/ }));

    expect(mocks.clearAttention).not.toHaveBeenCalled();
    expect(mocks.focusTask).not.toHaveBeenCalled();
  });
});
