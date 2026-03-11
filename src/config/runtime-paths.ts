import { dirname, join, resolve } from 'node:path';

export type RuntimePaths = {
  configFilePath: string;
  rootDir: string;
  stateFilePath: string;
};

export const resolveRuntimePaths = (input?: {
  configFilePath?: string;
  cwd?: string;
}): RuntimePaths => {
  const cwd = input?.cwd ?? process.cwd();
  const configFilePath = input?.configFilePath
    ? resolve(cwd, input.configFilePath)
    : join(cwd, 'bot.config.json');
  const rootDir = dirname(configFilePath);

  return {
    rootDir,
    configFilePath,
    stateFilePath: join(rootDir, '.data', 'state.json')
  };
};
