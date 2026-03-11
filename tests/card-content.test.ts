import { describe, expect, it } from 'vitest';

import {
  createHelpCard,
  createServerRequestCard,
  createThreadDetailsCard,
  createThreadsCard,
  createWorkspacesCard
} from '../src/bot/card-content.js';

describe('card content', () => {
  it('does not expose internal environment variable names in help text', () => {
    expect(createHelpCard().content).not.toContain('FEISHU_WORKSPACE_ROOT');
    expect(createHelpCard().content).toContain('`/mode {default|plan}`');
    expect(createHelpCard().content).toContain('`/thread {n}` Select the numbered thread from `/threads`');
  });

  it('renders a unified indexed workspace list with derived display names', () => {
    const card = createWorkspacesCard({
      activeWorkspaceCwd: '/tmp/apps/repo',
      entries: [
        {
          cwd: '/tmp/apps/repo',
          displayName: 'repo (apps/repo)',
          isCurrent: true
        },
        {
          cwd: '/tmp/experiments/repo',
          displayName: 'repo (experiments/repo)',
          isCurrent: false
        },
        {
          cwd: '/tmp/sandbox',
          displayName: 'sandbox',
          isCurrent: false
        }
      ],
      rootDirLabel: '/tmp'
    });

    expect(card.content).toContain('Current: `repo (apps/repo)`');
    expect(card.content).toContain('1. `repo (apps/repo)`');
    expect(card.content).toContain('current');
    expect(card.content).toContain('2. `repo (experiments/repo)`');
    expect(card.content).toContain('3. `sandbox`');
  });

  it('does not expose internal thread ids in thread list or details cards', () => {
    const threadsCard = createThreadsCard([
      {
        id: 'thr_123',
        preview: 'Fix failing tests',
        ephemeral: false,
        modelProvider: 'openai',
        createdAt: 1,
        updatedAt: 1,
        status: { type: 'idle' },
        path: null,
        cwd: '/tmp/repo',
        cliVersion: '0.113.0',
        source: 'cli',
        agentNickname: null,
        agentRole: null,
        gitInfo: null,
        name: null,
        turns: []
      }
    ]);
    const detailCard = createThreadDetailsCard(
      {
        thread: {
          id: 'thr_123',
          preview: 'Fix failing tests',
          ephemeral: false,
          modelProvider: 'openai',
          createdAt: 1,
          updatedAt: 1,
          status: { type: 'idle' },
          path: null,
          cwd: '/tmp/repo',
          cliVersion: '0.113.0',
          source: 'cli',
          agentNickname: null,
          agentRole: null,
          gitInfo: null,
          name: null,
          turns: [
            {
              id: 'turn_123',
              status: 'completed',
              items: [],
              error: null
            }
          ]
        }
      },
      1,
      true
    );

    expect(threadsCard.content).not.toContain('thr_123');
    expect(detailCard.content).not.toContain('thr_123');
    expect(detailCard.content).not.toContain('turn_123');
  });

  it('does not expose internal item ids in approval cards', () => {
    const card = createServerRequestCard({
      method: 'item/commandExecution/requestApproval',
      id: 1,
      params: {
        itemId: 'item_123'
      }
    } as never);

    expect(card?.content).toBe('Command execution was auto-approved.');
    expect(card?.content).not.toContain('item_123');
  });
});
