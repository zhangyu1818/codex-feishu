import type { ServerRequest } from '../generated/codex-protocol/ServerRequest.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import type { JsonRpcNotification } from '../codex/jsonl-rpc-client.js';
import type { CardRenderInput } from '../feishu/feishu-card-renderer.js';
import {
  createNotificationCard,
  createResultCard,
  createServerRequestCard
} from './card-content.js';
import {
  TurnRuntimeStatusStore,
  type WorkspaceRuntimeStatus
} from './turn-runtime-status-store.js';

type ActiveTurn = {
  chatId: string;
  text: string;
  turnId: string;
  workspaceCwd: string;
};

type TurnEventProcessorOptions = {
  onTurnCompleted: (input: {
    status: string;
    workspaceCwd: string;
  }) => Promise<void>;
  sendCard: (chatId: string, card: CardRenderInput) => Promise<void>;
  verbosity: RuntimeConfig['cards']['verbosity'];
};

const withMarkdownFence = (value: string): string =>
  value.includes('\n') ? `\n\`\`\`\n${value}\n\`\`\`` : value;

export class TurnEventProcessor {
  private readonly activeTurns = new Map<string, ActiveTurn>();
  private readonly onTurnCompleted: TurnEventProcessorOptions['onTurnCompleted'];
  private readonly runtimeStatus = new TurnRuntimeStatusStore();
  private readonly sendCard: TurnEventProcessorOptions['sendCard'];
  private readonly verbosity: TurnEventProcessorOptions['verbosity'];

  constructor(options: TurnEventProcessorOptions) {
    this.onTurnCompleted = options.onTurnCompleted;
    this.sendCard = options.sendCard;
    this.verbosity = options.verbosity;
  }

  public bindThread(input: {
    threadId: string;
    workspaceCwd: string;
  }): void {
    this.runtimeStatus.bindThread(input);
  }

  public getWorkspaceStatus(
    workspaceCwd: string
  ): WorkspaceRuntimeStatus | undefined {
    return this.runtimeStatus.getWorkspaceStatus(workspaceCwd);
  }

  public registerTurn(input: {
    chatId: string;
    threadId: string;
    turnId: string;
    workspaceCwd: string;
  }): void {
    this.runtimeStatus.registerTurn({
      threadId: input.threadId,
      turnId: input.turnId,
      workspaceCwd: input.workspaceCwd
    });
    this.activeTurns.set(input.turnId, {
      chatId: input.chatId,
      text: '',
      turnId: input.turnId,
      workspaceCwd: input.workspaceCwd
    });
  }

  public async handleNotification(
    notification: JsonRpcNotification
  ): Promise<void> {
    this.runtimeStatus.handleNotification(notification);
    await this.maybeSendProgressCard(notification);

    if (notification.method === 'item/agentMessage/delta') {
      this.appendTurnDelta(notification);
      return;
    }

    if (notification.method === 'item/completed') {
      this.captureCompletedMessage(notification);
      return;
    }

    if (notification.method === 'turn/completed') {
      await this.completeTurn(notification);
    }
  }

  public async handleServerRequest(request: ServerRequest): Promise<void> {
    this.runtimeStatus.handleServerRequest(request);

    const params = request.params as { turnId?: string } | undefined;
    const turnId = params?.turnId;
    const card = createServerRequestCard(request);

    if (!card || !turnId) {
      return;
    }

    const activeTurn = this.activeTurns.get(turnId);

    if (activeTurn) {
      await this.sendCard(activeTurn.chatId, card);
    }
  }

  private appendTurnDelta(notification: JsonRpcNotification): void {
    const params = notification.params as { delta?: string; turnId?: string } | undefined;
    const turnId = params?.turnId;

    if (!turnId) {
      return;
    }

    const activeTurn = this.activeTurns.get(turnId);

    if (activeTurn) {
      activeTurn.text += params?.delta ?? '';
    }
  }

  private captureCompletedMessage(notification: JsonRpcNotification): void {
    const params = notification.params as
      | {
          item?: { text?: string; type?: string };
          turnId?: string;
        }
      | undefined;
    const turnId = params?.turnId;

    if (!turnId || params?.item?.type !== 'agentMessage') {
      return;
    }

    const activeTurn = this.activeTurns.get(turnId);

    if (activeTurn) {
      activeTurn.text = params.item.text ?? activeTurn.text;
    }
  }

  private async completeTurn(notification: JsonRpcNotification): Promise<void> {
    const params = notification.params as
      | {
          turn?: { error?: { message?: string } | null; id: string; status: string };
        }
      | undefined;
    const turn = params?.turn;

    if (!turn) {
      return;
    }

    const activeTurn = this.activeTurns.get(turn.id);

    if (!activeTurn) {
      return;
    }

    await this.onTurnCompleted({
      workspaceCwd: activeTurn.workspaceCwd,
      status: turn.status
    });
    await this.sendCard(
      activeTurn.chatId,
      createResultCard({
        status: turn.status,
        text: activeTurn.text,
        error: turn.error?.message ? withMarkdownFence(turn.error.message) : null
      })
    );
    this.activeTurns.delete(turn.id);
  }

  private async maybeSendProgressCard(
    notification: JsonRpcNotification
  ): Promise<void> {
    if (this.verbosity === 'minimal') {
      return;
    }

    const params = notification.params as { turnId?: string } | undefined;
    const turnId = params?.turnId;
    const card = createNotificationCard(notification);

    if (!card || !turnId) {
      return;
    }

    const activeTurn = this.activeTurns.get(turnId);

    if (activeTurn) {
      await this.sendCard(activeTurn.chatId, card);
    }
  }
}
