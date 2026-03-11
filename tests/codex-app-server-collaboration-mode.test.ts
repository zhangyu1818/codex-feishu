import { PassThrough } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { CodexAppServer } from '../src/codex/codex-app-server.js';

const createMockChildProcess = () => ({
  kill: vi.fn(),
  stderr: new PassThrough(),
  stdin: new PassThrough(),
  stdout: new PassThrough()
});

describe('CodexAppServer collaboration mode', () => {
  it('passes collaboration mode overrides when starting a turn', async () => {
    const child = createMockChildProcess();
    const outboundMessages: Array<Record<string, unknown>> = [];

    child.stdin.on('data', (chunk) => {
      const lines = String(chunk).split('\n').filter(Boolean);

      for (const line of lines) {
        const message = JSON.parse(line) as Record<string, unknown>;
        outboundMessages.push(message);

        if (message.method === 'initialize') {
          child.stdout.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
          continue;
        }

        if (message.method === 'account/read') {
          child.stdout.write(
            `${JSON.stringify({
              id: message.id,
              result: {
                account: { type: 'apiKey' },
                requiresOpenaiAuth: true
              }
            })}\n`
          );
          continue;
        }

        if (message.method === 'turn/start') {
          child.stdout.write(
            `${JSON.stringify({
              id: message.id,
              result: {
                turn: {
                  id: 'turn_plan',
                  items: [],
                  status: 'inProgress',
                  error: null
                }
              }
            })}\n`
          );
        }
      }
    });

    const server = await CodexAppServer.start({
      clientInfo: {
        name: 'test_client',
        title: 'Test Client',
        version: '0.1.0'
      },
      requestTimeoutMs: 200,
      spawnProcess: () => child as never
    });

    await server.startTurn('thr_123', 'Plan the work', {
      cwd: '/tmp/project',
      model: 'gpt-5.4',
      collaborationMode: {
        mode: 'plan',
        settings: {
          model: 'gpt-5.4',
          reasoning_effort: null,
          developer_instructions: null
        }
      }
    });

    expect(
      outboundMessages.find((message) => message.method === 'turn/start')
    ).toEqual({
      id: 3,
      method: 'turn/start',
      params: {
        threadId: 'thr_123',
        input: [{ type: 'text', text: 'Plan the work', text_elements: [] }],
        cwd: '/tmp/project',
        approvalPolicy: 'never',
        sandboxPolicy: { type: 'dangerFullAccess' },
        model: 'gpt-5.4',
        collaborationMode: {
          mode: 'plan',
          settings: {
            model: 'gpt-5.4',
            reasoning_effort: null,
            developer_instructions: null
          }
        }
      }
    });

    server.close();
  });
});
