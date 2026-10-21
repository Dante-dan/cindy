import { Route, Routes } from 'react-router-dom';
import { AppFrame, forbid, mountPage, subscription } from '../../ui-page/harness';
import { BotGroupChatView } from '../../../src/renderer/features/bots/BotGroupChatView';
import { ControlledBanner } from '../../../src/renderer/features/remote-device/ControlledBanner';

interface GroupData {
  name: string;
  members: Array<{ botId: string; name: string }>;
  messages: number;
  sidebar: boolean;
  richAnswer?: boolean;
}

const richAnswer = 'Before the answer\n\n```cindy-ui\n' + [
  { seq: 1, op: 'create', id: 'root', kind: 'stack' },
  { seq: 2, op: 'create', id: 'title', parent: 'root', kind: 'heading', props: { text: 'Weekend plan' } },
  { seq: 3, op: 'create', id: 'body', parent: 'root', kind: 'markdown', props: { text: '**Bring a camera**\n\n- Walk by the river\n- Stop for lunch' } },
].map(op => JSON.stringify(op)).join('\n') + '\n```\n\nAfter the answer';

function groupFrom(data: GroupData) {
  return {
    id: 'fixture-group',
    name: data.name,
    replyMode: 'all',
    speakingMode: 'auto',
    members: data.members.map((member) => ({
      ...member,
      avatar: '',
      avatarColor: 'gray',
      status: 'active',
    })),
    organizerBotId: data.members[0]?.botId ?? null,
    projectDir: null,
    lastMessage: null,
    speakingBotIds: [],
    planningBotId: null,
    openPlan: null,
    createdAt: 1,
    updatedAt: 1,
    plans: [],
    messages: Array.from({ length: data.messages }, (_, i) => ({
      id: `m${i}`,
      sequence: i + 1,
      kind: 'message',
      authorKind: data.richAnswer ? 'bot' : 'user',
      authorBotId: data.richAnswer ? 'a' : null,
      authorName: data.richAnswer ? 'Aster' : '',
      content: data.richAnswer ? richAnswer : `Layout message ${i + 1}`,
      ...(data.richAnswer && i === 1 ? { threadShare: {
        messageId: 'source-reply', threadRootId: 'source-root', status: 'available',
        authorKind: 'bot', authorBotId: 'b', authorName: 'Nova', sharedByAuthor: false,
        content: richAnswer, attachments: [], createdAt: 1700000000000, edited: false,
      } } : {}),
      mentions: { all: false, botIds: [] },
      noticeCode: null,
      planId: null,
      attachments: [],
      createdAt: 1700000000000 + i,
    })),
    hasMoreBefore: false,
    round: { status: 'idle', speakers: [], canContinue: false },
  };
}

void mountPage({
  route: '/bots/groups/fixture-group',
  host: (ctx) => {
    const group = groupFrom(ctx.data as unknown as GroupData);
    return {
      maker: {
        listBotGroups: async () => ({ ok: true, groups: [] }),
        getBotGroup: async () => ({ ok: true, group }),
        onBotGroupChanged: subscription('botGroupChanged'),
        sendBotGroupMessage: forbid('maker.sendBotGroupMessage'),
        stopBotGroupRound: forbid('maker.stopBotGroupRound'),
      },
      deviceLink: {
        getState: async () => ({ controlledBy: [] }),
        onControlledState: subscription('controlledState'),
        revoke: forbid('deviceLink.revoke'),
      },
    };
  },
  render: (ctx) => {
    const data = ctx.data as unknown as GroupData;
    const sidebar = data.sidebar ? <div className="p-5" /> : undefined;
    return (
      <>
        <AppFrame sidebar={sidebar}>
          <div className="min-h-0 flex-1" data-ui-page-subject>
            <Routes>
              <Route path="/bots/groups/:groupId" element={<BotGroupChatView />} />
            </Routes>
          </div>
        </AppFrame>
        <ControlledBanner />
      </>
    );
  },
});
