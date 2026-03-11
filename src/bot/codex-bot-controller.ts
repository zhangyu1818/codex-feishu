import type { ServerRequest } from '../generated/codex-protocol/ServerRequest.js';
import { parseIncomingText } from '../commands/command-parser.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { CodexAppServer } from '../codex/codex-app-server.js';
import { detectGlobalCodexBinary } from '../codex/codex-binary.js';
import type { JsonRpcNotification } from '../codex/jsonl-rpc-client.js';
import type { CardRenderInput } from '../feishu/feishu-card-renderer.js';
import type { FeishuTextMessage } from '../feishu/feishu-message-filter.js';
import { createAckCard, createHelpCard, createNoWorkspaceCard } from './card-content.js';
import {
  handleModeCommandResponse,
  handleThreadCommandResponse,
  handleWorkspaceCommandResponse
} from './command-response-handlers.js';
import { TurnEventProcessor } from './turn-event-processor.js';
import { WorkspaceSessionService } from './workspace-session-service.js';
import { WorkspaceRegistry } from '../workspaces/workspace-registry.js';

type CodexBotControllerOptions = {
  config: RuntimeConfig;
  packageVersion: string;
  sendCard: (chatId: string, card: CardRenderInput) => Promise<void>;
  sendReplyCard: (messageId: string, card: CardRenderInput) => Promise<void>;
  stateFilePath: string;
};

export class CodexBotController {
  private readonly config: RuntimeConfig;
  private readonly sendReplyCard: CodexBotControllerOptions['sendReplyCard'];

  private codex!: CodexAppServer;
  private turns!: TurnEventProcessor;
  private workspaceRegistry!: WorkspaceRegistry;
  private workspaceSessions!: WorkspaceSessionService;

  private constructor(options: CodexBotControllerOptions) {
    this.config = options.config;
    this.sendReplyCard = options.sendReplyCard;
  }

  public static async create(
    options: CodexBotControllerOptions
  ): Promise<CodexBotController> {
    const controller = new CodexBotController(options);
    const binary = await detectGlobalCodexBinary();

    controller.codex = await CodexAppServer.start({
      clientInfo: {
        name: 'feishu_codex_bot',
        title: 'Feishu Codex Bot',
        version: options.packageVersion
      },
      requestTimeoutMs: 30_000,
      onNotification: async (notification) => {
        await controller.handleCodexNotification(notification);
      },
      onServerRequest: async (request) => {
        await controller.handleCodexServerRequest(request);
      }
    });
    controller.workspaceSessions = new WorkspaceSessionService({
      codex: controller.codex,
      codexVersion: binary.version,
      config: options.config,
      stateFilePath: options.stateFilePath
    });
    controller.workspaceRegistry = new WorkspaceRegistry({
      config: options.config,
      workspaceSessions: controller.workspaceSessions
    });
    controller.turns = new TurnEventProcessor({
      verbosity: options.config.cards.verbosity,
      sendCard: options.sendCard,
      onTurnCompleted: async (input) => {
        await controller.workspaceSessions.markTurnCompleted(input);
      }
    });
    await controller.workspaceSessions.load();
    controller.bindCurrentWorkspaceThread();

    return controller;
  }

  public async handleIncomingMessage(message: FeishuTextMessage): Promise<void> {
    const parsed = parseIncomingText(message.text);

    if (parsed.type === 'command') {
      await this.handleCommand(message, parsed.command, parsed.argument);
      return;
    }

    await this.handlePrompt(message, parsed.text);
  }

  public close(): void {
    this.codex.close();
  }

  private async handleCommand(
    message: FeishuTextMessage,
    command: string,
    argument?: string
  ): Promise<void> {
    const send = async (card: CardRenderInput) =>
      this.sendReplyCard(message.messageId, card);
    const normalized = command.toLowerCase();

    switch (normalized) {
      case 'help':
        await send(createHelpCard());
        return;
      case 'workspaces':
        await send(await this.workspaceSessions.getWorkspacesCard());
        return;
      case 'workspace':
        await handleWorkspaceCommandResponse({
          argument,
          bindCurrentWorkspaceThread: () => {
            this.bindCurrentWorkspaceThread();
          },
          send,
          turns: this.turns,
          workspaceRegistry: this.workspaceRegistry,
          workspaceSessions: this.workspaceSessions
        });
        return;
      case 'mode':
        await handleModeCommandResponse({
          argument,
          send,
          workspaceSessions: this.workspaceSessions
        });
        return;
      case 'new':
        await this.createFreshThread(send);
        return;
      case 'status':
        {
          const currentWorkspaceCwd = this.workspaceSessions.getCurrentWorkspaceCwd();
          const runtime = currentWorkspaceCwd
            ? this.turns.getWorkspaceStatus(currentWorkspaceCwd)
            : undefined;

          await send(await this.workspaceSessions.getStatusCard(runtime));
        }
        return;
      case 'interrupt':
        await this.handleInterruptCommand(send);
        return;
      case 'threads':
        await this.showThreads(send);
        return;
      case 'thread':
        await handleThreadCommandResponse({
          argument,
          bindCurrentWorkspaceThread: () => {
            this.bindCurrentWorkspaceThread();
          },
          send,
          workspaceSessions: this.workspaceSessions
        });
        return;
      default:
        await send({
          title: 'Unknown Command',
          content: `Unknown command: \`/${command}\``,
          template: 'red'
        });
    }
  }

  private async createFreshThread(send: (card: CardRenderInput) => Promise<void>): Promise<void> {
    const workspaceCwd = this.workspaceSessions.getCurrentWorkspaceCwd();

    if (!workspaceCwd) {
      await send(createNoWorkspaceCard('New Thread'));
      return;
    }

    const threadId = await this.workspaceSessions.createFreshThread();
    const workspaceName = await this.workspaceSessions.getWorkspaceDisplayName(workspaceCwd);

    this.turns.bindThread({
      threadId,
      workspaceCwd
    });

    await send({
      title: 'New Thread',
      content: `Started a fresh conversation for \`${workspaceName}\`.`,
      template: 'green'
    });
  }

  private async handleInterruptCommand(
    send: (card: CardRenderInput) => Promise<void>
  ): Promise<void> {
    const turnId = await this.workspaceSessions.interruptActiveTurn();

    await send({
      title: turnId ? 'Interrupt Requested' : 'Interrupt',
      content: turnId
        ? 'Requested interruption for the active request.'
        : 'No active turn is running.',
      template: turnId ? 'orange' : 'grey'
    });
  }

  private async showThreads(send: (card: CardRenderInput) => Promise<void>): Promise<void> {
    if (!this.workspaceSessions.getCurrentWorkspaceCwd()) {
      await send(createNoWorkspaceCard('Recent Threads'));
      return;
    }

    const threads = await this.workspaceSessions.listThreads();

    await send(this.workspaceSessions.createThreadsCard(threads));
  }

  private async handlePrompt(
    message: FeishuTextMessage,
    text: string
  ): Promise<void> {
    const workspaceCwd = this.workspaceSessions.getCurrentWorkspaceCwd();

    if (!workspaceCwd) {
      await this.sendReplyCard(message.messageId, createNoWorkspaceCard('Workspace Required'));
      return;
    }

    const threadId = await this.workspaceSessions.ensureWorkspaceThread(workspaceCwd, true);
    const workspaceState = this.workspaceSessions.getCurrentWorkspaceState();

    this.turns.bindThread({
      threadId,
      workspaceCwd
    });

    if (workspaceState?.activeTurnId && workspaceState.threadId) {
      await this.codex.steerTurn(workspaceState.threadId, workspaceState.activeTurnId, text);
      await this.sendReplyCard(message.messageId, createAckCard('Added guidance to the active turn.'));
      return;
    }

    const turn = await this.codex.startTurn(
      threadId,
      text,
      this.workspaceSessions.getTurnStartConfig(workspaceCwd)
    );
    const workspaceName = await this.workspaceSessions.getWorkspaceDisplayName(workspaceCwd);

    await this.workspaceSessions.markTurnStarted(turn.turn.id, String(turn.turn.status));
    this.turns.registerTurn({
      chatId: message.chatId,
      threadId,
      turnId: turn.turn.id,
      workspaceCwd
    });
    await this.sendReplyCard(
      message.messageId,
      createAckCard(`Started a new turn in \`${workspaceName}\`.`)
    );
  }

  private async handleCodexNotification(
    notification: JsonRpcNotification
  ): Promise<void> {
    await this.turns.handleNotification(notification);
  }

  private async handleCodexServerRequest(request: ServerRequest): Promise<void> {
    await this.turns.handleServerRequest(request);
  }

  private bindCurrentWorkspaceThread(): void {
    const workspaceCwd = this.workspaceSessions.getCurrentWorkspaceCwd();

    if (!workspaceCwd) {
      return;
    }

    const workspaceState = this.workspaceSessions.getCurrentWorkspaceState();

    if (!workspaceState?.threadId) {
      return;
    }

    this.turns.bindThread({
      threadId: workspaceState.threadId,
      workspaceCwd
    });
  }
}
