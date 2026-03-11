import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { JsonlRpcClient } from '../src/codex/jsonl-rpc-client.js';

describe('JsonlRpcClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends newline-delimited JSON and resolves matching responses', async () => {
    const stdout = new PassThrough();
    const stdin = new PassThrough();
    const sentChunks: string[] = [];

    stdin.on('data', (chunk) => {
      sentChunks.push(String(chunk));
    });

    const client = new JsonlRpcClient({
      stdin,
      stdout,
      requestTimeoutMs: 100
    });

    const pending = client.sendRequest<{ ok: boolean }>('initialize', {
      clientInfo: { name: 'test', title: 'Test', version: '0.1.0' }
    });

    stdout.write('{"id":1,"result":{"ok":true}}\n');

    await expect(pending).resolves.toEqual({ ok: true });
    expect(sentChunks.join('')).toContain('"method":"initialize"');
    expect(sentChunks.join('')).toMatch(/\n$/);
  });

  it('dispatches notifications to subscribers', async () => {
    const stdout = new PassThrough();
    const stdin = new PassThrough();
    const client = new JsonlRpcClient({
      stdin,
      stdout,
      requestTimeoutMs: 100
    });
    const handler = vi.fn();

    client.onNotification(handler);

    stdout.write('{"method":"turn/started","params":{"turn":{"id":"turn_123"}}}\n');
    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledWith({
        method: 'turn/started',
        params: { turn: { id: 'turn_123' } }
      });
    });
  });
});
