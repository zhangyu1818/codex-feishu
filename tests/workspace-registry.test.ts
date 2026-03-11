import { describe, expect, it, vi } from 'vitest';

import { parseRuntimeConfig } from '../src/config/runtime-config.js';
import { WorkspaceRegistry } from '../src/workspaces/workspace-registry.js';

describe('WorkspaceRegistry', () => {
  it('does not persist the workspace config when thread preparation fails', async () => {
    const config = parseRuntimeConfig(
      {
        serviceName: 'feishu_codex_bot',
        feishu: {
          appId: 'cli_123',
          appSecret: 'secret_123'
        },
        workspaceRoot: '/tmp/root',
        cardVerbosity: 'normal'
      }
    );
    const ensureWorkspaceThread = vi.fn(async () => {
      throw new Error('thread failed');
    });
    const activateWorkspace = vi.fn(async () => undefined);
    const registry = new WorkspaceRegistry({
      config,
      workspaceSessions: {
        activateWorkspace,
        ensureWorkspaceThread,
        getWorkspaceDisplayName: async () => 'sandbox'
      } as never
    });

    await expect(registry.addWorkspace('sandbox')).rejects.toThrow('thread failed');
    expect(ensureWorkspaceThread).toHaveBeenCalledOnce();
    expect(activateWorkspace).not.toHaveBeenCalled();
  });

  it('prepares then activates the workspace on success', async () => {
    const config = parseRuntimeConfig(
      {
        serviceName: 'feishu_codex_bot',
        feishu: {
          appId: 'cli_123',
          appSecret: 'secret_123'
        },
        workspaceRoot: '/tmp/root',
        cardVerbosity: 'normal'
      }
    );
    const calls: string[] = [];
    const registry = new WorkspaceRegistry({
      config,
      workspaceSessions: {
        activateWorkspace: async () => {
          calls.push('activate');
        },
        ensureWorkspaceThread: async () => {
          calls.push('prepare');
          return 'thr_123';
        },
        getWorkspaceDisplayName: async () => 'sandbox'
      } as never
    });

    const result = await registry.addWorkspace('sandbox');

    expect(calls).toEqual(['prepare', 'activate']);
    expect(result.threadId).toBe('thr_123');
    expect(result.displayName).toBe('sandbox');
  });
});
