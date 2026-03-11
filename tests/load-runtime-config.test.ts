import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { loadRuntimeConfig } from '../src/config/load-runtime-config.js';

describe('loadRuntimeConfig', () => {
  it('loads a self-contained config file', async () => {
    const rootDir = join(tmpdir(), `feishu-codex-bot-config-${Date.now()}`);
    await mkdir(rootDir, { recursive: true });
    const configFilePath = join(rootDir, 'bot.config.json');

    await writeFile(
      configFilePath,
      JSON.stringify(
        {
          serviceName: 'feishu_codex_bot',
          feishu: {
            appId: 'cli_from_file',
            appSecret: 'secret_from_file'
          },
          cardVerbosity: 'normal'
        },
        null,
        2
      )
    );

    const config = await loadRuntimeConfig({
      configFilePath,
      rootDir,
      stateFilePath: join(rootDir, '.data', 'state.json')
    });

    expect(config.feishu.appId).toBe('cli_from_file');
    expect(config.workspaces.rootDir).toBeUndefined();
  });
});
