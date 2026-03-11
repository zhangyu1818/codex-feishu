import { resolve } from 'node:path';

import { z } from 'zod';

const fileFeishuSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().min(1)
}).strict();

const fileConfigSchema = z.object({
  serviceName: z.string().min(1),
  feishu: fileFeishuSchema,
  cardVerbosity: z.enum(['minimal', 'normal']),
  workspaceRoot: z.string().min(1).optional()
}).strict();

export type BotFileConfig = z.infer<typeof fileConfigSchema>;
export type RuntimeConfig = {
  serviceName: string;
  feishu: {
    appId: string;
    appSecret: string;
  };
  workspaces: {
    rootDir?: string;
  };
  cards: {
    verbosity: z.infer<typeof fileConfigSchema>['cardVerbosity'];
  };
};

export const parseBotFileConfig = (fileInput: unknown): BotFileConfig =>
  fileConfigSchema.parse(fileInput);

export const serializeBotFileConfig = (
  config: RuntimeConfig
): BotFileConfig => ({
  serviceName: config.serviceName,
  feishu: {
    appId: config.feishu.appId,
    appSecret: config.feishu.appSecret
  },
  cardVerbosity: config.cards.verbosity,
  ...(config.workspaces.rootDir ? { workspaceRoot: config.workspaces.rootDir } : {})
});

export const parseRuntimeConfig = (
  fileInput: unknown,
  options?: {
    baseDir?: string;
  }
): RuntimeConfig => {
  const file = parseBotFileConfig(fileInput);
  const baseDir = options?.baseDir ?? process.cwd();

  return {
    serviceName: file.serviceName,
    feishu: {
      appId: file.feishu.appId,
      appSecret: file.feishu.appSecret
    },
    workspaces: {
      ...(file.workspaceRoot
        ? { rootDir: resolve(baseDir, file.workspaceRoot) }
        : {})
    },
    cards: {
      verbosity: file.cardVerbosity
    }
  };
};
