import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CodexBotController } from './bot/codex-bot-controller.js';
import { parseCliOptions } from './config/cli-options.js';
import { loadRuntimeConfig } from './config/load-runtime-config.js';
import { resolveRuntimePaths } from './config/runtime-paths.js';
import { FeishuBot } from './feishu/feishu-bot.js';
import { FeishuMessenger } from './feishu/feishu-messenger.js';

const readPackageVersion = async (rootDir: string): Promise<string> => {
  try {
    const source = await readFile(join(rootDir, 'package.json'), 'utf8');
    const parsed = JSON.parse(source) as { version?: string };
    return parsed.version ?? '0.1.0';
  } catch (error) {
    const maybeNodeError = error as NodeJS.ErrnoException;

    if (maybeNodeError.code === 'ENOENT') {
      return '0.1.0';
    }

    throw error;
  }
};

const main = async (): Promise<void> => {
  const cliOptions = parseCliOptions(process.argv.slice(2));
  const paths = resolveRuntimePaths(
    cliOptions.configFilePath
      ? {
          configFilePath: cliOptions.configFilePath
        }
      : undefined
  );
  const [config, packageVersion] = await Promise.all([
    loadRuntimeConfig(paths),
    readPackageVersion(paths.rootDir)
  ]);

  console.info('[bootstrap] loaded config', {
    appId: `${config.feishu.appId.slice(0, 8)}...`,
    configFilePath: paths.configFilePath,
    workspaceRoot: config.workspaces.rootDir ?? '(disabled)'
  });

  const messenger = new FeishuMessenger({
    appId: config.feishu.appId,
    appSecret: config.feishu.appSecret
  });
  const controller = await CodexBotController.create({
    config,
    packageVersion,
    sendCard: async (chatId, card) => {
      await messenger.sendCard(chatId, card);
    },
    sendReplyCard: async (messageId, card) => {
      await messenger.replyCard(messageId, card);
    },
    stateFilePath: paths.stateFilePath
  });
  const bot = new FeishuBot(config, controller, messenger);
  const shutdown = () => {
    bot.stop();
    controller.close();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await bot.start();
  console.info('[bootstrap] bot is ready');
};

await main();
