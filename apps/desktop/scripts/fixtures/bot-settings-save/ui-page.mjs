import assert from 'node:assert/strict';

const stubs = {
  'src/renderer/hooks/useProviders': 'export const useProviders=()=>[];',
  'src/renderer/hooks/useAvailableAgents': 'const vendors=new Set(["cc","codex","pi"]);export const useAvailableAgents=()=>({availableVendors:vendors,loaded:true});export const getCachedAvailableVendors=()=>vendors;',
  'src/renderer/features/feature-context': { partial: 'export const useRegisterContentHeader=()=>{};' },
  'src/renderer/features/bots/botStore': { partial: `
    export const useBotProfiles=()=>[];
    export const getEffectiveBotModelChain=()=>[];
    export const subscribeBotGlobalModel=()=>()=>{};
    export async function updateBotProfile(id,patch){
      const calls=window.__uiBotSaves??=[];
      calls.push(patch);
      if(window.__uiPage.ctx.case==='host-error' && calls.length===1) throw new Error('[INTERNAL] Fixture storage unavailable');
      return {id,...patch};
    }
  ` },
};
// These unrelated settings surfaces are not exercised by the personality case.
// Keep BotSettings, its real textarea, translations, hook and autosave scheduler.
for (const name of ['BotRosterView','BotPortraitPicker','BotBasicProfileFields','BotLifecycleSettings','BotInvitationWelcome','BotModelChainEditor','BotTaskModelEditor','BotCapabilitySettings','BotRoutines','BotAutonomySettings','BotTodoList','BotMemorySettings','BotChannelsPage','BotHomeComputerSetting','CindyMergeSetting']) {
  stubs[`src/renderer/features/bots/${name}`]=`export const ${name}=()=>null;`;
}
export default {
  name: 'bot-settings-save',
  entry: './bot-settings-save-fixture.tsx',
  viewport: { width: 760, height: 720 },
  real: 'BotSettings personality editor, Textarea, useBotSettingsAutosave, autosave scheduling and failure reason, translations and semantic theme tokens',
  notCovered: 'Real IPC/storage, other settings subpages, navigation/discard contract, Windows runtime',
  stubs,
  cases: {
    default: { about: 'Full oversized draft is retained, explains trimmed UTF-16 limit and recovers after correction', data: {} },
    'host-error': { about: 'Temporary host failure is identifiable and retry saves the intact draft', data: {} },
  },
  async check(page, ui) {
    await page.getByRole('button', { name: await ui.t('bots.profile.personality'), exact: true }).click();
    const editor=page.getByRole('textbox', {name: await ui.t('bots.profile.personality')});
    if(ui.case==='default') {
      const text='😀'.repeat(6000)+'x';
      await editor.fill(text);
      await page.getByRole('alert').waitFor();
      assert.equal(await editor.inputValue(),text,'full rejected draft remains editable');
      assert.equal(await editor.getAttribute('aria-invalid'),'true');
      assert.equal(await page.evaluate(()=>window.__uiBotSaves?.length??0),0,'invalid draft never submitted');
      assert.equal(await page.getByRole('button',{name:await ui.t('bots.autosave.retry')}).isDisabled(),true);
      await ui.capture('over-limit');
      await editor.fill('  Corrected personality.\n');
    } else {
      await editor.fill('A personality awaiting storage.');
      await page.getByRole('alert').waitFor();
      assert.ok((await page.getByRole('alert').innerText()).includes(await ui.t('ipcError.INTERNAL')));
      await ui.capture('host-error');
    }
    // A corrected draft resumes debounced autosave; the retry control can already
    // disappear before this step. Only a host failure needs an explicit retry.
    if (ui.case==='host-error')
      await page.getByRole('button',{name:await ui.t('bots.autosave.retry')}).click();
    await page.getByRole('alert').waitFor({state:'detached'});
    const saved=await page.evaluate(()=>window.__uiBotSaves.at(-1).identitySource);
    assert.equal(saved,ui.case==='default'?'Corrected personality.':'A personality awaiting storage.');
  },
};
