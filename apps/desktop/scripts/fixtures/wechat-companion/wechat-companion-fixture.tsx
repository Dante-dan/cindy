import { useState } from 'react';
import { ImChannelSettingsCard } from '../../../src/renderer/components/settings/ImChannelSettingsCard';
import { WechatBotSection } from '../../../src/renderer/components/settings/WechatBotSection';
import { Switch } from '../../../src/renderer/components/ui/switch';
import { BotChannelsPage } from '../../../src/renderer/features/bots/BotChannelsPage';
import type { BotProfile } from '../../../src/renderer/features/bots/botStore';
import { mountPage, subscription, forbid } from '../../ui-page/harness';

function PersonalCard() {
  const [expanded, setExpanded] = useState(false);
  return <WechatBotSection expanded={expanded} onToggle={() => setExpanded((value) => !value)} />;
}

function HeaderActionCard() {
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  return (
    <ImChannelSettingsCard
      id="fixture-header-action"
      title="Feishu"
      description="Channel settings"
      status={<span>Connected</span>}
      routeSummary="Codex · gpt-6.1-sol"
      expanded={expanded}
      onToggle={() => setExpanded((value) => !value)}
      headerAction={
        <Switch aria-label="Enable channel" checked={enabled} onCheckedChange={setEnabled} />
      }
    >
      <span>Channel editor</span>
    </ImChannelSettingsCard>
  );
}

mountPage({
  host: (ctx) => ({
    botImConnection: {
      list: async () => ({ connections: [] }),
      onChanged: subscription('connections'),
    },
    maker: {
      imDefaultSettingsGet: async () => ({
        agentKind: 'codex',
        agents: { codex: { model: 'gpt-6.1-sol' } },
      }),
    },
    wechatBot: {
      getState: async () => ({
        phase: ctx.data.bound ? 'connected' : 'disconnected',
        bound: !!ctx.data.bound,
        queuedTasks: 0,
      }),
      getChannelSettings: async () => ({
        version: 1,
        workingDir: null,
        workingDirAvailable: true,
        companionBotId: ctx.data.companionBotId,
      }),
      onStateChange: subscription('wechatState'),
      onChannelSettingsChange: subscription('wechatSettings'),
      setCompanion: forbid('wechatBot.setCompanion'),
      authorize: forbid('wechatBot.authorize'),
      unbind: forbid('wechatBot.unbind'),
    },
  }),
  render: (ctx) => (
    <div className="ml-auto p-4" style={{ width: ctx.data.narrow ? 426 : 680 }}>
      {ctx.data.personal ? (
        <PersonalCard />
      ) : ctx.data.headerAction ? (
        <HeaderActionCard />
      ) : (
        <BotChannelsPage
          bot={
            {
              id: 'fixture-cindy',
              name: ctx.data.longName ? 'Alfred — 长名称伙伴用于窄抽屉回归' : 'Cindy',
              status: 'active',
            } as BotProfile
          }
        />
      )}
    </div>
  ),
});
