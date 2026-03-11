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

describe('CodexAppServer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes, checks auth, forwards notifications, and auto-approves requests', async () => {
    const child = createMockChildProcess();
    const outboundMessages: Array<Record<string, unknown>> = [];
    const notifications: string[] = [];

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

        if (message.method === 'thread/start') {
          child.stdout.write(
            `${JSON.stringify({
              id: message.id,
              result: {
                thread: {
                  id: 'thr_123',
                  preview: '',
                  ephemeral: false,
                  modelProvider: 'openai',
                  createdAt: 1,
                  updatedAt: 1,
                  status: { type: 'idle' },
                  path: null,
                  cwd: '/tmp/project',
                  cliVersion: '0.112.0',
                  source: { kind: 'appServer' },
                  agentNickname: null,
                  agentRole: null,
                  gitInfo: null,
                  name: null,
                  turns: []
                },
                model: 'gpt-5.1-codex',
                modelProvider: 'openai',
                serviceTier: null,
                cwd: '/tmp/project',
                approvalPolicy: 'never',
                sandbox: { type: 'dangerFullAccess' },
                reasoningEffort: null
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
                  id: 'turn_123',
                  items: [],
                  status: 'inProgress',
                  error: null
                }
              }
            })}\n`
          );
          child.stdout.write(
            `${JSON.stringify({
              method: 'turn/started',
              params: {
                threadId: 'thr_123',
                turn: {
                  id: 'turn_123',
                  items: [],
                  status: 'inProgress',
                  error: null
                }
              }
            })}\n`
          );
          child.stdout.write(
            `${JSON.stringify({
              id: 'approval_1',
              method: 'item/commandExecution/requestApproval',
              params: {
                threadId: 'thr_123',
                turnId: 'turn_123',
                itemId: 'cmd_1'
              }
            })}\n`
          );
          continue;
        }

        if (message.id === 'approval_1') {
          child.stdout.write(
            `${JSON.stringify({
              method: 'turn/completed',
              params: {
                threadId: 'thr_123',
                turn: {
                  id: 'turn_123',
                  items: [],
                  status: 'completed',
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
      onNotification: (notification) => {
        notifications.push(notification.method);
      },
      spawnProcess: () => child as never
    });

    const thread = await server.startThread({
      cwd: '/tmp/project',
      model: 'gpt-5.1-codex',
      serviceName: 'test-service'
    });
    const turn = await server.startTurn('thr_123', 'Run tests', {
      cwd: '/tmp/project',
      model: 'gpt-5.1-codex'
    });

    expect(thread.thread.id).toBe('thr_123');
    expect(turn.turn.id).toBe('turn_123');
    expect(notifications).toContain('turn/started');
    expect(notifications).toContain('turn/completed');
    expect(outboundMessages).toContainEqual({ method: 'initialized' });
    expect(outboundMessages).toContainEqual({
      id: 'approval_1',
      result: { decision: 'accept' }
    });

    server.close();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('omits model overrides when inheriting the global codex config', async () => {
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

        if (message.method === 'thread/start') {
          child.stdout.write(
            `${JSON.stringify({
              id: message.id,
              result: {
                thread: {
                  id: 'thr_456',
                  preview: '',
                  ephemeral: false,
                  modelProvider: 'openai',
                  createdAt: 1,
                  updatedAt: 1,
                  status: { type: 'idle' },
                  path: null,
                  cwd: '/tmp/project',
                  cliVersion: '0.112.0',
                  source: { kind: 'appServer' },
                  agentNickname: null,
                  agentRole: null,
                  gitInfo: null,
                  name: null,
                  turns: []
                },
                model: 'gpt-5.4',
                modelProvider: 'openai',
                serviceTier: null,
                cwd: '/tmp/project',
                approvalPolicy: 'never',
                sandbox: { type: 'dangerFullAccess' },
                reasoningEffort: 'xhigh'
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
                  id: 'turn_456',
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

    await server.startThread({
      cwd: '/tmp/project',
      serviceName: 'test-service'
    });
    await server.startTurn('thr_456', 'Use global defaults', {
      cwd: '/tmp/project'
    });

    const threadStartRequest = outboundMessages.find(
      (message) => message.method === 'thread/start'
    );
    const turnStartRequest = outboundMessages.find(
      (message) => message.method === 'turn/start'
    );

    expect(threadStartRequest).toBeDefined();
    expect(turnStartRequest).toBeDefined();
    expect(threadStartRequest).not.toHaveProperty('params.model');
    expect(turnStartRequest).not.toHaveProperty('params.model');

    server.close();
  });
});
