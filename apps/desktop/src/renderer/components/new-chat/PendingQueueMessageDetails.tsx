import * as Dialog from '@radix-ui/react-dialog';
import { Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';

/** Read-only projection: never takes a queue lock or changes dispatch. */
export function PendingQueueMessageDetails({ content, index }: { content: string; index: number }) {
  const { t } = useTranslation();

  return (
    <Dialog.Root>
      <Tip text={t('newChat.pendingQueue.viewAction')} side="top">
        <Dialog.Trigger asChild>
          <button
            type="button"
            aria-label={t('newChat.pendingQueue.viewAria', { index })}
            className="focus-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--chat-input-border)] bg-[var(--chat-input-bg)] text-[var(--settings-section-desc)] hover:text-[var(--msg-assistant-text)]"
          >
            <Eye size={13} strokeWidth={2} aria-hidden />
          </button>
        </Dialog.Trigger>
      </Tip>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-scrim fixed inset-0 z-[10000]" />
        <Dialog.Content
          onKeyDown={(event) => {
            // Portal events still bubble through the queue row in React.
            // Reading must not route Cmd/Ctrl+Enter into its steer action.
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) event.stopPropagation();
          }}
          className="modal-panel fixed left-1/2 top-1/2 z-[10001] flex w-[min(600px,calc(100vw-32px))] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 p-4">
          <Dialog.Title className="text-15 font-medium text-[var(--text-primary)]">
            {t('newChat.pendingQueue.viewAction')}
          </Dialog.Title>
          <Dialog.Description className="min-h-0 overflow-y-auto whitespace-pre-wrap break-words text-13 leading-relaxed text-[var(--text-primary)]" tabIndex={0}>
            {content}
          </Dialog.Description>
          <div className="flex shrink-0 justify-end">
            <Dialog.Close asChild>
              <Button variant="secondary" size="sm" type="button">
                {t('newChat.pendingQueue.closeDetails')}
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
