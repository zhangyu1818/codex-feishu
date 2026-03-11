import { describe, expect, it, vi } from 'vitest';

import { TurnEventProcessor } from '../src/bot/turn-event-processor.js';

describe('TurnEventProcessor', () => {
  it('tracks runtime status details without requiring streamed card pushes', async () => {
    const sendCard = vi.fn(async () => undefined);
    const onTurnCompleted = vi.fn(async () => undefined);
    const processor = new TurnEventProcessor({
      verbosity: 'minimal',
      sendCard,
      onTurnCompleted
    });

    processor.bindThread({
      threadId: 'thr_123',
      workspaceCwd: '/tmp/repo'
    });
    processor.registerTurn({
      chatId: 'chat_123',
      threadId: 'thr_123',
      turnId: 'turn_123',
      workspaceCwd: '/tmp/repo'
    });

    await processor.handleNotification({
      method: 'thread/status/changed',
      params: {
        threadId: 'thr_123',
        status: {
          type: 'active',
          activeFlags: ['waitingOnModel']
        }
      }
    });
    await processor.handleNotification({
      method: 'turn/plan/updated',
      params: {
        threadId: 'thr_123',
        turnId: 'turn_123',
        explanation: 'Working through the repo',
        plan: [
          {
            step: 'Inspect the repository',
            status: 'completed'
          },
          {
            step: 'Implement the fix',
            status: 'inProgress'
          }
        ]
      }
    });
    await processor.handleNotification({
      method: 'thread/tokenUsage/updated',
      params: {
        threadId: 'thr_123',
        turnId: 'turn_123',
        tokenUsage: {
          total: {
            totalTokens: 400,
            inputTokens: 250,
            cachedInputTokens: 20,
            outputTokens: 150,
            reasoningOutputTokens: 40
          },
          last: {
            totalTokens: 120,
            inputTokens: 70,
            cachedInputTokens: 10,
            outputTokens: 50,
            reasoningOutputTokens: 15
          },
          modelContextWindow: 200_000
        }
      }
    });
    await processor.handleNotification({
      method: 'item/started',
      params: {
        threadId: 'thr_123',
        turnId: 'turn_123',
        item: {
          type: 'commandExecution',
          id: 'cmd_123',
          command: 'npm test',
          cwd: '/tmp/repo',
          processId: null,
          status: 'inProgress',
          commandActions: [],
          aggregatedOutput: null,
          exitCode: null,
          durationMs: null
        }
      }
    });
    await processor.handleNotification({
      method: 'item/commandExecution/outputDelta',
      params: {
        threadId: 'thr_123',
        turnId: 'turn_123',
        itemId: 'cmd_123',
        delta: 'vitest: all green\n'
      }
    });
    await processor.handleNotification({
      method: 'item/completed',
      params: {
        threadId: 'thr_123',
        turnId: 'turn_123',
        item: {
          type: 'mcpToolCall',
          id: 'tool_123',
          server: 'github',
          tool: 'search',
          status: 'completed',
          arguments: {},
          result: null,
          error: null,
          durationMs: 14
        }
      }
    });
    await processor.handleServerRequest({
      id: 'approval_123',
      method: 'item/fileChange/requestApproval',
      params: {
        itemId: 'patch_123',
        threadId: 'thr_123',
        turnId: 'turn_123'
      }
    });

    const status = processor.getWorkspaceStatus('/tmp/repo');

    expect(status).toMatchObject({
      activeThreadId: 'thr_123',
      activeTurnId: 'turn_123',
      threadStatus: 'active',
      threadActiveFlags: ['waitingOnModel'],
      planExplanation: 'Working through the repo',
      toolCallCount: 1
    });
    expect(status?.planSteps).toHaveLength(2);
    expect(status?.tokenUsage?.last.outputTokens).toBe(50);
    expect(status?.recentTools).toEqual(['github.search']);
    expect(status?.recentActivity).toContain('Command started: `npm test`');
    expect(status?.recentActivity).toContain(
      'Tool completed: `github.search`'
    );
    expect(status?.recentActivity).toContain('Auto-approved file changes');
    expect(status?.lastCommandOutput).toContain('vitest: all green');
    expect(sendCard).toHaveBeenCalledTimes(1);
  });
});
