import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

import type { InitializeParams } from '../generated/codex-protocol/InitializeParams.js';
import type { ServerRequest } from '../generated/codex-protocol/ServerRequest.js';
import type { CommandExecutionRequestApprovalResponse } from '../generated/codex-protocol/v2/CommandExecutionRequestApprovalResponse.js';
import type { FileChangeRequestApprovalResponse } from '../generated/codex-protocol/v2/FileChangeRequestApprovalResponse.js';
import type { GetAccountResponse } from '../generated/codex-protocol/v2/GetAccountResponse.js';
import type { ThreadListResponse } from '../generated/codex-protocol/v2/ThreadListResponse.js';
import type { ThreadReadResponse } from '../generated/codex-protocol/v2/ThreadReadResponse.js';
import type { ThreadResumeParams } from '../generated/codex-protocol/v2/ThreadResumeParams.js';
import type { ThreadResumeResponse } from '../generated/codex-protocol/v2/ThreadResumeResponse.js';
import type { ThreadStartParams } from '../generated/codex-protocol/v2/ThreadStartParams.js';
import type { ThreadStartResponse } from '../generated/codex-protocol/v2/ThreadStartResponse.js';
import type { ThreadSourceKind } from '../generated/codex-protocol/v2/ThreadSourceKind.js';
import type { TurnInterruptParams } from '../generated/codex-protocol/v2/TurnInterruptParams.js';
import type { TurnStartParams } from '../generated/codex-protocol/v2/TurnStartParams.js';
import type { TurnStartResponse } from '../generated/codex-protocol/v2/TurnStartResponse.js';
import type { TurnSteerParams } from '../generated/codex-protocol/v2/TurnSteerParams.js';
import type { ToolRequestUserInputResponse } from '../generated/codex-protocol/v2/ToolRequestUserInputResponse.js';
import type { ToolRequestUserInputQuestion } from '../generated/codex-protocol/v2/ToolRequestUserInputQuestion.js';
import { JsonlRpcClient, type JsonRpcNotification, type JsonRpcServerRequest } from './jsonl-rpc-client.js';
import type { CollaborationMode } from '../generated/codex-protocol/CollaborationMode.js';

export type CodexClientInfo = {
  name: string;
  title: string;
  version: string;
};

export type CodexThreadConfig = {
  cwd: string;
  model?: string;
  serviceName: string;
};

export type CodexServerRequestHandler = (
  request: ServerRequest
) => Promise<void> | void;

export type ListThreadsOptions = {
  cwd?: string;
  limit?: number;
  sourceKinds?: ThreadSourceKind[];
};

type CodexAppServerOptions = {
  clientInfo: CodexClientInfo;
  requestTimeoutMs: number;
  onNotification?: (notification: JsonRpcNotification) => void;
  onServerRequest?: CodexServerRequestHandler;
  spawnProcess?: () => ChildProcessWithoutNullStreams;
};

const DEFAULT_THREAD_SOURCE_KINDS: ThreadSourceKind[] = [
  'cli',
  'vscode',
  'appServer'
];

const createInitializeParams = (
  clientInfo: CodexClientInfo
): InitializeParams => ({
  clientInfo: {
    name: clientInfo.name,
    title: clientInfo.title,
    version: clientInfo.version
  },
  capabilities: {
    experimentalApi: true
  }
});

const createThreadStartParams = (
  config: CodexThreadConfig
): ThreadStartParams => {
  const params: ThreadStartParams = {
    cwd: config.cwd,
    approvalPolicy: 'never',
    sandbox: 'danger-full-access',
    serviceName: config.serviceName,
    experimentalRawEvents: false,
    persistExtendedHistory: true
  };

  if (config.model) {
    params.model = config.model;
  }

  return params;
};

const createThreadResumeParams = (
  threadId: string,
  config: CodexThreadConfig
): ThreadResumeParams => {
  const params: ThreadResumeParams = {
    threadId,
    cwd: config.cwd,
    approvalPolicy: 'never',
    sandbox: 'danger-full-access',
    persistExtendedHistory: true
  };

  if (config.model) {
    params.model = config.model;
  }

  return params;
};

const createTurnStartParams = (
  threadId: string,
  text: string,
  config: Pick<CodexThreadConfig, 'cwd' | 'model'> & {
    collaborationMode?: CollaborationMode;
  }
): TurnStartParams => {
  const params: TurnStartParams = {
    threadId,
    input: [{ type: 'text', text, text_elements: [] }],
    cwd: config.cwd,
    approvalPolicy: 'never',
    sandboxPolicy: { type: 'dangerFullAccess' }
  };

  if (config.model) {
    params.model = config.model;
  }

  if (config.collaborationMode) {
    params.collaborationMode = config.collaborationMode;
  }

  return params;
};

const createTurnSteerParams = (
  threadId: string,
  turnId: string,
  text: string
): TurnSteerParams => ({
  threadId,
  expectedTurnId: turnId,
  input: [{ type: 'text', text, text_elements: [] }]
});

const autoAnswerToolRequest = (
  request: Extract<ServerRequest, { method: 'item/tool/requestUserInput' }>
): ToolRequestUserInputResponse => ({
  answers: Object.fromEntries(
    request.params.questions.map((question: ToolRequestUserInputQuestion) => {
      const firstOption = question.options?.[0]?.label ?? '';

      return [
        question.id,
        {
          answers: firstOption ? [firstOption] : []
        }
      ];
    })
  )
});

const defaultServerRequestHandler = (
  rpc: JsonlRpcClient,
  request: JsonRpcServerRequest
): void => {
  const typedRequest = request as ServerRequest;

  switch (typedRequest.method) {
    case 'item/commandExecution/requestApproval':
      rpc.sendResult(typedRequest.id, {
        decision: 'accept'
      } satisfies CommandExecutionRequestApprovalResponse);
      return;
    case 'item/fileChange/requestApproval':
      rpc.sendResult(typedRequest.id, {
        decision: 'accept'
      } satisfies FileChangeRequestApprovalResponse);
      return;
    case 'item/tool/requestUserInput':
      rpc.sendResult(typedRequest.id, autoAnswerToolRequest(typedRequest));
      return;
    case 'applyPatchApproval':
    case 'execCommandApproval':
      rpc.sendResult(typedRequest.id, { decision: 'approved' });
      return;
    default:
      rpc.sendError(typedRequest.id, {
        code: -32000,
        message: `Unsupported server request: ${typedRequest.method}`
      });
  }
};

export class CodexAppServer {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly rpc: JsonlRpcClient;
  private readonly onServerRequest: CodexServerRequestHandler | undefined;

  private constructor(
    child: ChildProcessWithoutNullStreams,
    rpc: JsonlRpcClient,
    onServerRequest?: CodexServerRequestHandler
  ) {
    this.child = child;
    this.rpc = rpc;
    this.onServerRequest = onServerRequest;
  }

  public static async start(
    options: CodexAppServerOptions
  ): Promise<CodexAppServer> {
    const child =
      options.spawnProcess?.() ??
      spawn('codex', ['app-server'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
    const rpc = new JsonlRpcClient({
      stdin: child.stdin,
      stdout: child.stdout,
      requestTimeoutMs: options.requestTimeoutMs
    });
    const server = new CodexAppServer(child, rpc, options.onServerRequest);

    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
    });

    rpc.onNotification((notification) => {
      options.onNotification?.(notification);
    });
    rpc.onServerRequest(async (request) => {
      defaultServerRequestHandler(rpc, request);
      await options.onServerRequest?.(request as ServerRequest);
    });

    await server.initialize(options.clientInfo);
    await server.assertAuthenticated();

    return server;
  }

  public async startThread(
    config: CodexThreadConfig
  ): Promise<ThreadStartResponse> {
    return this.rpc.sendRequest<ThreadStartResponse>(
      'thread/start',
      createThreadStartParams(config)
    );
  }

  public async resumeThread(
    threadId: string,
    config: CodexThreadConfig
  ): Promise<ThreadResumeResponse> {
    return this.rpc.sendRequest<ThreadResumeResponse>(
      'thread/resume',
      createThreadResumeParams(threadId, config)
    );
  }

  public async listThreads(options: ListThreadsOptions = {}): Promise<ThreadListResponse> {
    const {
      cwd,
      limit = 10,
      sourceKinds = DEFAULT_THREAD_SOURCE_KINDS
    } = options;

    return this.rpc.sendRequest<ThreadListResponse>('thread/list', {
      limit,
      sourceKinds,
      ...(cwd ? { cwd } : {})
    });
  }

  public async readThread(threadId: string): Promise<ThreadReadResponse> {
    return this.rpc.sendRequest<ThreadReadResponse>('thread/read', {
      threadId,
      includeTurns: true
    });
  }

  public async startTurn(
    threadId: string,
    text: string,
    config: Pick<CodexThreadConfig, 'cwd' | 'model'> & {
      collaborationMode?: CollaborationMode;
    }
  ): Promise<TurnStartResponse> {
    return this.rpc.sendRequest<TurnStartResponse>(
      'turn/start',
      createTurnStartParams(threadId, text, config)
    );
  }

  public async steerTurn(
    threadId: string,
    turnId: string,
    text: string
  ): Promise<{ turnId: string }> {
    return this.rpc.sendRequest<{ turnId: string }>(
      'turn/steer',
      createTurnSteerParams(threadId, turnId, text)
    );
  }

  public async interruptTurn(
    threadId: string,
    turnId: string
  ): Promise<void> {
    const params: TurnInterruptParams = {
      threadId,
      turnId
    };

    await this.rpc.sendRequest('turn/interrupt', params);
  }

  public close(): void {
    this.rpc.close();
    this.child.kill('SIGTERM');
  }

  private async initialize(clientInfo: CodexClientInfo): Promise<void> {
    await this.rpc.sendRequest('initialize', createInitializeParams(clientInfo));
    this.rpc.sendNotification('initialized');
  }

  private async assertAuthenticated(): Promise<void> {
    const account = await this.rpc.sendRequest<GetAccountResponse>('account/read', {
      refreshToken: false
    });

    if (account.account || !account.requiresOpenaiAuth) {
      return;
    }

    throw new Error(
      'Codex app-server requires local authentication. Log into codex CLI before starting the bot.'
    );
  }
}
