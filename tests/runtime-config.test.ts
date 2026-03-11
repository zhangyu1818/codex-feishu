import { describe, expect, it } from 'vitest';

import { parseRuntimeConfig } from '../src/config/runtime-config.js';

describe('parseRuntimeConfig', () => {
  it('parses a self-contained config into a validated runtime config', () => {
    const config = parseRuntimeConfig(
      {
        serviceName: 'feishu_codex_bot',
        feishu: {
          appId: 'cli_123',
          appSecret: 'secret_123'
        },
        cardVerbosity: 'normal'
      }
    );

    expect(config.feishu.appId).toBe('cli_123');
    expect(config.workspaces.rootDir).toBeUndefined();
  });

  it('parses workspaceRoot when present', () => {
    const config = parseRuntimeConfig(
      {
        serviceName: 'feishu_codex_bot',
        feishu: {
          appId: 'cli_123',
          appSecret: 'secret_123'
        },
        workspaceRoot: '/tmp/workspaces',
        cardVerbosity: 'normal'
      }
    );

    expect(config.workspaces.rootDir).toBe('/tmp/workspaces');
  });

  it('accepts a self-contained config file without .env credentials', () => {
    const config = parseRuntimeConfig(
      {
        serviceName: 'feishu_codex_bot',
        feishu: {
          appId: 'cli_from_file',
          appSecret: 'secret_from_file'
        },
        cardVerbosity: 'normal',
        workspaceRoot: './workspaces'
      },
      {
        baseDir: '/tmp/runtime-root'
      }
    );

    expect(config.feishu.appId).toBe('cli_from_file');
    expect(config.feishu.appSecret).toBe('secret_from_file');
    expect(config.workspaces.rootDir).toBe('/tmp/runtime-root/workspaces');
  });

  it('allows config files without workspace declarations', () => {
    const config = parseRuntimeConfig({
      serviceName: 'feishu_codex_bot',
      feishu: {
        appId: 'cli_123',
        appSecret: 'secret_123'
      },
      cardVerbosity: 'normal'
    });

    expect(config.workspaces.rootDir).toBeUndefined();
  });

  it('rejects unsupported workspace declarations', () => {
    expect(() =>
      parseRuntimeConfig({
        serviceName: 'feishu_codex_bot',
        feishu: {
          appId: 'cli_123',
          appSecret: 'secret_123'
        },
        cardVerbosity: 'normal',
        workspaces: []
      })
    ).toThrow();
  });

  it('rejects unsupported card verbosity values', () => {
    expect(() =>
      parseRuntimeConfig({
        serviceName: 'feishu_codex_bot',
        feishu: {
          appId: 'cli_123',
          appSecret: 'secret_123'
        },
        cardVerbosity: 'verbose'
      })
    ).toThrow();
  });
});
