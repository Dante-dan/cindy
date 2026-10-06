// @vitest-environment jsdom
// Regression requested in issue #5538, comment-6022521338.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PendingQueuePanel } from '../PendingQueuePanel';
import type { QueuedMessage } from '@/lib/makerChatStore';

vi.mock('react-i18next', async (original) => ({ ...await original<typeof import('react-i18next')>(), useTranslation: () => ({ t: (key: string, opts?: { index?: number }) => opts?.index ? `${key} ${opts.index}` : key }) }));
vi.mock('@/components/chat/SentInlineAtomBody', () => ({ SentInlineAtomBody: () => null }));
vi.mock('@/components/chat/MessageSourceLabels', () => ({ QueueSourceDeviceTag: () => null }));
vi.mock('@/features/bots/BotAvatar', () => ({ BotAvatar: () => null }));
vi.mock('@/features/bots/botStore', () => ({ useBotProfiles: () => [] }));
vi.mock('@/components/ui/tooltip', () => ({ Tip: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/sidebar/SortableList', () => ({
  SortableList: ({ items, renderItem }: { items: QueuedMessage[]; renderItem: (item: QueuedMessage, index: number) => ReactNode }) => (
    <div>{items.map((item, index) => <div key={item.clientId}>{renderItem(item, index)}</div>)}</div>
  ),
}));

function entry(index: number): QueuedMessage {
  const visibleText = `Paragraph one ${index}\n\n${'Long visible instruction. '.repeat(80)}\nEND-${index}`;
  return {
    clientId: `queued-${index}`,
    text: 'internal prompt wrapper',
    persistedContent: visibleText,
    origin: { kind: 'orca', senderLabel: 'Leader', displayText: visibleText },
    chatMessage: { clientId: `queued-${index}`, role: 'user', content: visibleText },
    createOpts: { workingDir: '/tmp' },
  } as QueuedMessage;
}

afterEach(cleanup);

describe('read-only queue details', () => {
  it('opens full first and expanded-tail bodies without queue actions or locks', () => {
    const queue = Array.from({ length: 5 }, (_, index) => entry(index + 1));
    const mutation = vi.fn();
    const props = { queue, expanded: false, onToggle: mutation, onRemove: mutation, onSteer: mutation, onEditBegin: mutation, onEditLock: mutation, onInteractionLock: mutation, onReorder: mutation, onResume: mutation };
    const { rerender } = render(<PendingQueuePanel {...props} />);
    expect(screen.queryByRole('button', { name: 'newChat.pendingQueue.viewAria 5' })).toBeNull();

    const firstTrigger = screen.getByRole('button', { name: 'newChat.pendingQueue.viewAria 1' });
    act(() => firstTrigger.focus());
    fireEvent.click(firstTrigger);
    expect(screen.getByRole('dialog').textContent).toContain('END-1');
    expect(screen.getByRole('dialog').textContent).not.toContain('internal prompt wrapper');
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter', metaKey: true });
    expect(mutation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'newChat.pendingQueue.closeDetails' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(<PendingQueuePanel {...props} expanded />);
    fireEvent.click(screen.getByRole('button', { name: 'newChat.pendingQueue.viewAria 5' }));
    expect(screen.getByRole('dialog').textContent).toContain('END-5');
    expect(mutation).not.toHaveBeenCalled();

    // Normal dequeue unmounts the row and its detail without holding dispatch.
    rerender(<PendingQueuePanel {...props} expanded queue={queue.slice(0, 4)} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mutation).not.toHaveBeenCalled();
  });

  it('does not expose internal synthetic instructions through the detail entry', () => {
    const synthetic = { ...entry(1), text: '[UI_ACTION_TRIGGER] private prompt' };
    render(<PendingQueuePanel queue={[synthetic]} expanded={false} onToggle={() => {}} onRemove={() => {}} />);
    expect(screen.queryByRole('button', { name: 'newChat.pendingQueue.viewAria 1' })).toBeNull();
    expect(screen.queryByText(/private prompt/)).toBeNull();
  });
});
