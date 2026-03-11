import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CodexAppServer } from '../src/codex/codex-app-server.js';

type MockChildProcess = {
  kill: ReturnType<typeof vi.fn>;
  stderr: PassThrough;
  stdin: PassThrough;
  stdout: PassThrough;
};

const createMockChildProcess = (): MockChildProcess => ({
  kill: vi.fn(),
  stderr: new PassThrough(),
  stdin: new PassThrough(),
  stdout: new PassThrough()
});

describe('CodexAppServer.listThreads', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests cli, vscode, and app-server sources explicitly', async () => {
    const child = createMockChildProcess();
    const outboundMessages: Array<Record<string, unknown>> = [];

    child.stdin.on('data', (chunk) => {
      const lines = String(chunk)
        .split('\n')
        .filter(Boolean);

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

        if (message.method === 'thread/list') {
          child.stdout.write(
            `${JSON.stringify({
              id: message.id,
              result: {
                data: [],
                nextCursor: null
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

    await server.listThreads({ limit: 20 });

    expect(outboundMessages).toContainEqual({
      id: expect.any(Number),
      method: 'thread/list',
      params: {
        limit: 20,
        sourceKinds: ['cli', 'vscode', 'appServer']
      }
    });

    server.close();
  });
});
