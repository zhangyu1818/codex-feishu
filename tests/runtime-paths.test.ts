import { describe, expect, it } from 'vitest';

import { resolveRuntimePaths } from '../src/config/runtime-paths.js';

describe('resolveRuntimePaths', () => {
  it('uses the config file directory as the runtime root when overridden', () => {
    const paths = resolveRuntimePaths({
      configFilePath: '/tmp/feishu-bot/bot.config.json',
      cwd: '/Users/yu/example'
    });

    expect(paths.rootDir).toBe('/tmp/feishu-bot');
    expect(paths.configFilePath).toBe('/tmp/feishu-bot/bot.config.json');
    expect(paths.stateFilePath).toBe('/tmp/feishu-bot/.data/state.json');
  });
});
