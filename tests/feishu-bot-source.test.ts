import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const feishuBotSourcePath = join(
  process.cwd(),
  'src',
  'feishu',
  'feishu-bot.ts'
);

describe('feishu-bot source', () => {
  it('does not register bot menu events', async () => {
    const source = await readFile(feishuBotSourcePath, 'utf8');

    expect(source).not.toContain('application.bot.menu_v6');
  });
});
