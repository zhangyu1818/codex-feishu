import { createInterface, type Interface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';

type JsonRpcId = number | string;

type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

type JsonRpcResponse = {
  id: JsonRpcId;
  result?: unknown;
  error?: JsonRpcError;
};

export type JsonRpcNotification = {
  method: string;
  params?: unknown;
};

export type JsonRpcServerRequest = {
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

type PendingRequest = {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
  timeout: NodeJS.Timeout;
};

type JsonlRpcClientOptions = {
  stdin: Writable;
  stdout: Readable;
  requestTimeoutMs: number;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isResponse = (value: unknown): value is JsonRpcResponse =>
  isObject(value) && 'id' in value && ('result' in value || 'error' in value);

const isServerRequest = (value: unknown): value is JsonRpcServerRequest =>
  isObject(value) && 'id' in value && typeof value.method === 'string';

const isNotification = (value: unknown): value is JsonRpcNotification =>
  isObject(value) && !('id' in value) && typeof value.method === 'string';

const toError = (response: JsonRpcResponse): Error => {
  if (!response.error) {
    return new Error('Unknown JSON-RPC error');
  }

  return new Error(
    `JSON-RPC ${response.error.code}: ${response.error.message}`
  );
};

export class JsonlRpcClient {
  private readonly stdin: Writable;
  private readonly requestTimeoutMs: number;
  private readonly pendingRequests = new Map<JsonRpcId, PendingRequest>();
  private readonly notifications = new Set<
    (notification: JsonRpcNotification) => void
  >();
  private readonly serverRequests = new Set<
    (request: JsonRpcServerRequest) => void
  >();
  private readonly readline: Interface;
  private nextId = 1;

  constructor(options: JsonlRpcClientOptions) {
    this.stdin = options.stdin;
    this.requestTimeoutMs = options.requestTimeoutMs;
    this.readline = createInterface({ input: options.stdout });
    this.readline.on('line', (line) => {
      this.handleLine(line);
    });
  }

  public onNotification(
    listener: (notification: JsonRpcNotification) => void
  ): () => void {
    this.notifications.add(listener);

    return () => {
      this.notifications.delete(listener);
    };
  }

  public onServerRequest(
    listener: (request: JsonRpcServerRequest) => void
  ): () => void {
    this.serverRequests.add(listener);

    return () => {
      this.serverRequests.delete(listener);
    };
  }

  public async sendRequest<TResponse>(
    method: string,
    params?: unknown
  ): Promise<TResponse> {
    const id = this.nextId++;

    return new Promise<TResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`JSON-RPC request timed out: ${method}`));
      }, this.requestTimeoutMs);

      this.pendingRequests.set(id, {
        resolve: (value: unknown) => {
          resolve(value as TResponse);
        },
        reject,
        timeout
      });
      this.writeMessage({ id, method, ...(params ? { params } : {}) });
    });
  }

  public sendNotification(method: string, params?: unknown): void {
    this.writeMessage({ method, ...(params ? { params } : {}) });
  }

  public sendResult(id: JsonRpcId, result: unknown): void {
    this.writeMessage({ id, result });
  }

  public sendError(id: JsonRpcId, error: JsonRpcError): void {
    this.writeMessage({ id, error });
  }

  public close(): void {
    this.readline.close();

    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`JSON-RPC client closed: ${id}`));
    }

    this.pendingRequests.clear();
  }

  private handleLine(line: string): void {
    if (!line.trim()) {
      return;
    }

    const payload = JSON.parse(line) as unknown;

    if (isResponse(payload)) {
      this.resolveResponse(payload);
      return;
    }

    if (isServerRequest(payload)) {
      for (const listener of this.serverRequests) {
        listener(payload);
      }

      return;
    }

    if (isNotification(payload)) {
      for (const listener of this.notifications) {
        listener(payload);
      }
    }
  }

  private resolveResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);

    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(toError(response));
      return;
    }

    pending.resolve(response.result);
  }

  private writeMessage(message: Record<string, unknown>): void {
    this.stdin.write(`${JSON.stringify(message)}\n`);
  }
}
