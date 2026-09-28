// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedModelEntry } from '@cindy/model-providers';
import { ModelConfigFlyout } from '../components/new-chat/ModelConfigFlyout';
import type { UnifiedRowConfig } from '../components/new-chat/unifiedModelSelection';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => values?.value ? `${values.value} context` : key }),
}));
vi.mock('../components/new-chat/ModelHarnessPicker', () => ({ ModelHarnessPicker: () => null }));
vi.mock('../components/new-chat/EffortSlider', () => ({ EffortSlider: () => null }));

afterEach(cleanup);

function fixture(
  agent: 'claude-code' | 'pi',
  providerId = 'custom:test',
  localContextLimitEnabled = true,
) {
  const entry: UnifiedModelEntry = {
    providerId, modelId: 'gpt-6', displayName: 'Sample GPT', candidates: [agent],
    recommended: agent, nativeAgent: null, capabilities: {},
  };
  const config: UnifiedRowConfig = {
    engine: agent === 'claude-code' ? 'cc' : agent,
    agent, efforts: [], effort: null, fast: false, fastCapable: false,
    customized: false, wireModelId: agent === 'claude-code' ? 'chatgpt/gpt-6' : 'gpt-6',
    capability: {
      agent, wireModelId: agent === 'claude-code' ? 'chatgpt/gpt-6' : 'gpt-6',
      efforts: [], defaultEffort: null, defaultEffortSource: 'none', supportsFastMode: false,
      contextWindow: 272_000, contextWindowVerified: true,
      protocolMode: 'unknown', nativeApi: null, outboundApi: null,
    },
  };
  return <ModelConfigFlyout entry={entry} config={config} state="recommended"
    sourceLabel="Sample provider" price={null} effortLabelOf={() => ''}
    localContextLimitEnabled={localContextLimitEnabled}
    onEngineChange={vi.fn()} onEffortChange={vi.fn()} onFastChange={vi.fn()}
    onResetToRecommended={vi.fn()} onAddFavorite={vi.fn()} onRemoveFavorite={vi.fn()} />;
}

describe('non-Codex configured context in model flyout', () => {
  it.each(['claude-code', 'pi'] as const)('reads the saved 100000-token %s override by provider and wire model', async (agent) => {
    const getModelContextLimit = vi.fn(async () => ({ limit: 100_000, isCustomized: true }));
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: { maker: { getModelContextLimit } } });
    const view = render(fixture(agent));
    await waitFor(() => expect(view.container.textContent).toContain('100K context'));
    expect(getModelContextLimit).toHaveBeenCalledWith({ agent, providerId: 'custom:test', modelId: agent === 'claude-code' ? 'chatgpt/gpt-6' : 'gpt-6' });
  });

  it('uses the target provider after switching and returns to its default after reset', async () => {
    let saved: number | null = 100_000;
    const getModelContextLimit = vi.fn(async (target: { providerId: string }) => ({
      limit: target.providerId === 'custom:other' ? 150_000 : saved,
      isCustomized: true,
    }));
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: { maker: { getModelContextLimit } } });
    const view = render(fixture('claude-code'));
    await waitFor(() => expect(view.container.textContent).toContain('100K context'));
    view.rerender(fixture('pi', 'custom:other'));
    await waitFor(() => expect(view.container.textContent).toContain('150K context'));
    saved = null;
    view.rerender(fixture('claude-code'));
    await waitFor(() => expect(view.container.textContent).toContain('272K context'));
  });

  it('stops showing a local override immediately for remote or injected provider views', async () => {
    const getModelContextLimit = vi.fn(async () => ({ limit: 100_000, isCustomized: true }));
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: { maker: { getModelContextLimit } } });
    const view = render(fixture('pi'));
    await waitFor(() => expect(view.container.textContent).toContain('100K context'));
    view.rerender(fixture('pi', 'custom:remote', false));
    expect(view.container.textContent).toContain('272K context');
    expect(view.container.textContent).not.toContain('100K context');
    expect(getModelContextLimit).toHaveBeenCalledTimes(1);
  });
});
