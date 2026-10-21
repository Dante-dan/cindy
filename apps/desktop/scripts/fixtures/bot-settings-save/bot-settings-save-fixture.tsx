import { BotSettings } from '../../../src/renderer/features/bots/BotsHomeView';
import type { BotProfile } from '../../../src/renderer/features/bots/botStore';
import { mountPage } from '../../ui-page/harness';

const bot: BotProfile = {
  id: 'fixture-teammate', name: 'PR steward', description: 'Public fixture',
  identitySource: 'Persistent role', userContextSource: '', avatar: '🧭', avatarColor: 'violet',
  enabled: true, status: 'active', currentVersion: 1, skills: [], canonicalSessionId: 'fixture-chat',
  homeDir: '/fixture/teammate', createdAt: 1, sessions: [],
  capabilities: {
    model: '', providerId: null, effort: 'medium', fastMode: false, harness: 'pi',
    modelChain: [], modelChainOverride: null, skillMode: 'inherit', skillsExcluded: [],
    toolsetMode: 'inherit', toolsets: [], mcpMode: 'inherit', mcpServers: [], memory: true, permissions: 'ask',
  },
};

mountPage({
  route: '/bots/fixture-teammate?settings=1',
  render: () => <div className="flex h-screen flex-col pt-4">
    <BotSettings bot={bot} onBack={() => {}} onOpenSession={() => {}} />
  </div>,
});
