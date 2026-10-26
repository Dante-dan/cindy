export default {
  name: 'wechat-companion',
  entry: './wechat-companion-fixture.tsx',
  viewport: { width: 1280, height: 900 },
  real: 'BotChannelsPage, WechatBotSection, useWechatBot, existing connection accordion and translations',
  notCovered:
    'Real account login, Tencent scan authorization, persisted binding and message delivery',
  cases: {
    default: { about: 'New WeChat connection for a teammate', data: {} },
    existing: {
      about: 'Reuse the already authorized personal WeChat connection',
      data: { bound: true },
    },
    assigned: {
      about: 'Connected teammate and remove-link action',
      data: { bound: true, companionBotId: 'fixture-cindy' },
    },
    'narrow-assigned': {
      about: 'Wide desktop with a 394px card and long teammate name',
      data: { bound: true, companionBotId: 'fixture-cindy', narrow: true, longName: true },
    },
    'narrow-unassigned': {
      about: 'Wide desktop narrow card before binding',
      data: { narrow: true },
    },
    personal: {
      about: 'Personal settings keeps its assigned route summary',
      data: { bound: true, companionBotId: 'fixture-cindy', personal: true },
    },
    'header-action': {
      about: 'Shared accordion with independent enable switch and model summary',
      data: { headerAction: true },
    },
    other: {
      about: 'Another teammate owns this connection',
      data: { bound: true, companionBotId: 'fixture-other' },
    },
  },
  async check(page, ui) {
    const trigger = page.locator(
      ui.data.personal
        ? '#personal-im-wechat-trigger'
        : ui.data.headerAction
          ? '#fixture-header-action-trigger'
          : '#companion-im-wechat-trigger',
    );
    if (ui.data.headerAction) {
      const action = page.getByRole('switch', { name: 'Enable channel' });
      await action.click();
      if ((await action.getAttribute('aria-checked')) !== 'false')
        throw new Error('Header switch did not toggle');
      if ((await trigger.getAttribute('aria-expanded')) !== 'false')
        throw new Error('Header switch expanded the card');
    }
    await trigger.waitFor();
    if (ui.data.narrow) {
      const titleWidth = await trigger
        .locator('span > span')
        .first()
        .evaluate((element) => element.getBoundingClientRect().width);
      if (titleWidth < 150)
        throw new Error(`WeChat title squeezed to ${titleWidth}px in narrow card`);
    }
    await trigger.click();
    if ((await trigger.getAttribute('aria-expanded')) !== 'true')
      throw new Error('WeChat card did not expand');
    await ui.capture('expanded');
    await trigger.click();
    if ((await trigger.getAttribute('aria-expanded')) !== 'false')
      throw new Error('WeChat card did not collapse');
  },
};
