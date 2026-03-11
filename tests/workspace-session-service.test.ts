import { describe, expect, it } from 'vitest';

import { parseRuntimeConfig } from '../src/config/runtime-config.js';
import { WorkspaceSessionService } from '../src/bot/workspace-session-service.js';

describe('WorkspaceSessionService', () => {
  it('selects the most recent historical workspace when no workspace is preconfigured', async () => {
    const stateFilePath = `/tmp/workspace-session-service-${Date.now()}-1.json`;
    const config = parseRuntimeConfig({
      serviceName: 'feishu_codex_bot',
      feishu: {
        appId: 'cli_123',
        appSecret: 'secret_123'
      },
      cardVerbosity: 'normal'
    });
    const service = new WorkspaceSessionService({
      codex: {
        listThreads: async ({ limit, cwd }: { limit?: number; cwd?: string } = {}) => ({
          data:
            !cwd && limit === 1
              ? [
                  {
                    id: 'thr_latest',
                    preview: 'latest',
                    ephemeral: false,
                    modelProvider: 'openai',
                    createdAt: 2,
                    updatedAt: 2,
                    status: { type: 'idle' },
                    path: null,
                    cwd: '/tmp/history-repo',
                    cliVersion: '0.113.0',
                    source: 'cli',
                    agentNickname: null,
                    agentRole: null,
                    gitInfo: null,
                    name: 'Latest history',
                    turns: []
                  }
                ]
              : [],
          nextCursor: null
        })
      } as never,
      codexVersion: '0.113.0',
      config,
      stateFilePath
    });

    await service.load();

    expect(service.getCurrentWorkspaceCwd()).toBe('/tmp/history-repo');
  });

  it('renders guidance when no current workspace exists', async () => {
    const stateFilePath = `/tmp/workspace-session-service-${Date.now()}-2.json`;
    const config = parseRuntimeConfig({
      serviceName: 'feishu_codex_bot',
      feishu: {
        appId: 'cli_123',
        appSecret: 'secret_123'
      },
      cardVerbosity: 'normal'
    });
    const service = new WorkspaceSessionService({
      codex: {
        listThreads: async () => ({
          data: [],
          nextCursor: null
        })
      } as never,
      codexVersion: '0.113.0',
      config,
      stateFilePath
    });

    await service.load();

    const workspacesCard = await service.getWorkspacesCard();
    const statusCard = await service.getStatusCard();

    expect(workspacesCard.content).toContain('No workspaces found.');
    expect(statusCard.content).toContain('No workspace selected.');
  });

  it('lists discovered workspaces as one indexed list', async () => {
    const stateFilePath = `/tmp/workspace-session-service-${Date.now()}-3.json`;
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

    const service = new WorkspaceSessionService({
      codex: {
        listThreads: async () => ({
          data: [
            {
              id: 'thr_1',
              preview: 'hello',
              ephemeral: false,
              modelProvider: 'openai',
              createdAt: 1,
              updatedAt: 1,
              status: { type: 'idle' },
              path: null,
              cwd: '/tmp/existing-app-project',
              cliVersion: '0.113.0',
              source: 'appServer',
              agentNickname: null,
              agentRole: null,
              gitInfo: null,
              name: 'Existing project',
              turns: []
            },
            {
              id: 'thr_2',
              preview: 'repo work',
              ephemeral: false,
              modelProvider: 'openai',
              createdAt: 2,
              updatedAt: 2,
              status: { type: 'idle' },
              path: null,
              cwd: '/tmp/repo',
              cliVersion: '0.113.0',
              source: 'cli',
              agentNickname: null,
              agentRole: null,
              gitInfo: null,
              name: 'Repo thread',
              turns: []
            }
          ],
          nextCursor: null
        })
      } as never,
      codexVersion: '0.113.0',
      config,
      stateFilePath
    });

    await service.load();
    const card = await service.getWorkspacesCard();

    expect(card.content).toContain('1. `existing-app-project`');
    expect(card.content).toContain('2. `repo`');
    expect(card.content).toContain('`/tmp/existing-app-project`');
    expect(card.content).toContain('current');
  });

  it('uses the same derived workspace name in the status card when paths would collide', async () => {
    const stateFilePath = `/tmp/workspace-session-service-${Date.now()}-4.json`;
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

    const service = new WorkspaceSessionService({
      codex: {
        listThreads: async ({ limit, cwd }: { limit?: number; cwd?: string } = {}) => ({
          data:
            !cwd && limit === 1
              ? [
                  {
                    id: 'thr_1',
                    preview: 'apps repo',
                    ephemeral: false,
                    modelProvider: 'openai',
                    createdAt: 1,
                    updatedAt: 1,
                    status: { type: 'idle' },
                    path: null,
                    cwd: '/tmp/apps/repo',
                    cliVersion: '0.113.0',
                    source: 'appServer',
                    agentNickname: null,
                    agentRole: null,
                    gitInfo: null,
                    name: 'Apps repo',
                    turns: []
                  }
                ]
              : [
                  {
                    id: 'thr_1',
                    preview: 'apps repo',
                    ephemeral: false,
                    modelProvider: 'openai',
                    createdAt: 1,
                    updatedAt: 1,
                    status: { type: 'idle' },
                    path: null,
                    cwd: '/tmp/apps/repo',
                    cliVersion: '0.113.0',
                    source: 'appServer',
                    agentNickname: null,
                    agentRole: null,
                    gitInfo: null,
                    name: 'Apps repo',
                    turns: []
                  },
                  {
                    id: 'thr_2',
                    preview: 'experiments repo',
                    ephemeral: false,
                    modelProvider: 'openai',
                    createdAt: 2,
                    updatedAt: 2,
                    status: { type: 'idle' },
                    path: null,
                    cwd: '/tmp/experiments/repo',
                    cliVersion: '0.113.0',
                    source: 'cli',
                    agentNickname: null,
                    agentRole: null,
                    gitInfo: null,
                    name: 'Experiments repo',
                    turns: []
                  }
                ],
          nextCursor: null
        })
      } as never,
      codexVersion: '0.113.0',
      config,
      stateFilePath
    });

    await service.load();
    const card = await service.getStatusCard();

    expect(card.content).toContain('Workspace: `repo (apps/repo)`');
    expect(card.content).toContain('Path: `/tmp/apps/repo`');
  });
});
