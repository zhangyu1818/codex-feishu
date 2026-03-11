import { readFile } from 'node:fs/promises';

import {
  parseRuntimeConfig,
  type RuntimeConfig
} from './runtime-config.js';
import type { RuntimePaths } from './runtime-paths.js';

const readJsonFile = async (filePath: string): Promise<unknown> => {
  const source = await readFile(filePath, 'utf8');
  return JSON.parse(source) as unknown;
};

export const loadRuntimeConfig = async (
  paths: RuntimePaths
): Promise<RuntimeConfig> => {
  const fileConfig = await readJsonFile(paths.configFilePath);

  return parseRuntimeConfig(fileConfig, {
    baseDir: paths.rootDir
  });
};
