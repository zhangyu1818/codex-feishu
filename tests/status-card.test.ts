import { describe, expect, it } from 'vitest';

import { createStatusCard } from '../src/bot/card-content.js';

describe('status card', () => {
  it('renders enriched runtime details without exposing them as streamed updates', () => {
    const card = createStatusCard({
      activeTurnId: 'turn_123',
      codexVersion: '0.113.0',
      currentWorkspaceCwd: '/tmp/repo',
      currentWorkspaceName: 'repo',
      modeKind: 'plan',
      threadId: 'thr_123',
      turnStatus: 'inProgress',
      runtime: {
        activeThreadId: 'thr_123',
        activeTurnId: 'turn_123',
        elapsedMs: 12_000,
        threadStatus: 'active',
        threadActiveFlags: ['waitingOnModel'],
        toolCallCount: 2,
        recentTools: ['github.search', 'browser.open'],
        recentActivity: [
          'Command started: `npm test`',
          'Tool completed: `github.search`'
        ],
        planExplanation: 'Finish the fix safely',
        planSteps: [
          {
            step: 'Inspect the repo',
            status: 'completed'
          },
          {
            step: 'Implement the change',
            status: 'inProgress'
          }
        ],
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
        },
        diffSummary: '2 files changed across 3 hunks',
        lastCommandOutput: 'vitest: all green'
      }
    });

    expect(card.content).toContain('Mode: `plan`');
    expect(card.content).toContain('Conversation: ready');
    expect(card.content).toContain('Request: running');
    expect(card.content).toContain('Request status: inProgress');
    expect(card.content).toContain('Elapsed: `12s`');
    expect(card.content).toContain(
      'Thread runtime: active (waitingOnModel)'
    );
    expect(card.content).toContain(
      'Last token usage: input 70, output 50, total 120'
    );
    expect(card.content).toContain('Recent tools: `github.search`, `browser.open`');
    expect(card.content).toContain('Recent plan:');
    expect(card.content).toContain('- [completed] Inspect the repo');
    expect(card.content).toContain('Recent activity:');
    expect(card.content).toContain('- Command started: `npm test`');
    expect(card.content).toContain('Diff: 2 files changed across 3 hunks');
    expect(card.content).toContain('Last command output:');
    expect(card.content).not.toContain('thr_123');
    expect(card.content).not.toContain('turn_123');
  });
});
