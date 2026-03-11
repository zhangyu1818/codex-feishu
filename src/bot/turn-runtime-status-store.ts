import type { ServerRequest } from '../generated/codex-protocol/ServerRequest.js';
import type { ThreadItem } from '../generated/codex-protocol/v2/ThreadItem.js';
import type { ThreadStatus } from '../generated/codex-protocol/v2/ThreadStatus.js';
import type { ThreadTokenUsage } from '../generated/codex-protocol/v2/ThreadTokenUsage.js';
import type { TurnPlanStep } from '../generated/codex-protocol/v2/TurnPlanStep.js';
import type { JsonRpcNotification } from '../codex/jsonl-rpc-client.js';
import {
  applyCommandOutputDelta,
  applyItemLifecycle,
  applyServerRequestActivity,
  applyThreadStatus,
  applyTokenUsage,
  applyToolProgress,
  applyTurnCompleted,
  applyTurnDiff,
  applyTurnPlan
} from './turn-runtime-status-mutations.js';
import {
  cloneRuntimeStatus,
  createEmptyRuntimeRecord,
  type WorkspaceRuntimeRecord,
  type WorkspaceRuntimeStatus
} from './turn-runtime-status-model.js';

export type { WorkspaceRuntimeStatus } from './turn-runtime-status-model.js';

export class TurnRuntimeStatusStore {
  private readonly statuses = new Map<string, WorkspaceRuntimeRecord>();
  private readonly threadToWorkspace = new Map<string, string>();
  private readonly toolItemsCounted = new Set<string>();
  private readonly turnToWorkspace = new Map<string, string>();

  public bindThread(input: {
    threadId: string;
    workspaceCwd: string;
  }): void {
    this.threadToWorkspace.set(input.threadId, input.workspaceCwd);

    const record = this.getOrCreateRecord(input.workspaceCwd);

    if (record.activeThreadId && record.activeThreadId !== input.threadId) {
      this.statuses.set(input.workspaceCwd, createEmptyRuntimeRecord());
    }

    this.getOrCreateRecord(input.workspaceCwd).activeThreadId = input.threadId;
  }

  public getWorkspaceStatus(
    workspaceCwd: string
  ): WorkspaceRuntimeStatus | undefined {
    const record = this.statuses.get(workspaceCwd);

    return record ? cloneRuntimeStatus(record) : undefined;
  }

  public handleNotification(notification: JsonRpcNotification): void {
    switch (notification.method) {
      case 'thread/status/changed':
        this.updateThreadStatus(notification);
        return;
      case 'thread/tokenUsage/updated':
        this.updateThreadTokenUsage(notification);
        return;
      case 'turn/started':
        this.updateTurnStarted(notification);
        return;
      case 'turn/plan/updated':
        this.updateTurnPlan(notification);
        return;
      case 'turn/diff/updated':
        this.updateTurnDiff(notification);
        return;
      case 'item/started':
      case 'item/completed':
        this.updateItemLifecycle(notification);
        return;
      case 'item/commandExecution/outputDelta':
        this.updateCommandOutput(notification);
        return;
      case 'item/mcpToolCall/progress':
        this.updateToolProgress(notification);
        return;
      case 'turn/completed':
        this.updateTurnCompleted(notification);
        return;
      default:
    }
  }

  public handleServerRequest(request: ServerRequest): void {
    if (request.method === 'item/commandExecution/requestApproval') {
      this.recordServerRequestActivity(request, 'Auto-approved command execution');
      return;
    }

    if (request.method === 'item/fileChange/requestApproval') {
      this.recordServerRequestActivity(request, 'Auto-approved file changes');
    }
  }

  public registerTurn(input: {
    threadId: string;
    turnId: string;
    workspaceCwd: string;
  }): void {
    this.bindThread({
      threadId: input.threadId,
      workspaceCwd: input.workspaceCwd
    });
    this.turnToWorkspace.set(input.turnId, input.workspaceCwd);

    const record = this.getOrCreateRecord(input.workspaceCwd);

    record.activeTurnId = input.turnId;
    record.turnStartedAtMs = Date.now();
  }

  private getOrCreateRecord(workspaceCwd: string): WorkspaceRuntimeRecord {
    const current = this.statuses.get(workspaceCwd);

    if (current) {
      return current;
    }

    const created = createEmptyRuntimeRecord();

    this.statuses.set(workspaceCwd, created);
    return created;
  }

  private recordServerRequestActivity(
    request:
      | Extract<ServerRequest, { method: 'item/commandExecution/requestApproval' }>
      | Extract<ServerRequest, { method: 'item/fileChange/requestApproval' }>,
    text: string
  ): void {
    const record = this.getRecordFromContext(
      request.params.threadId,
      request.params.turnId
    );

    if (!record) {
      return;
    }

    applyServerRequestActivity(record, text);
  }

  private updateCommandOutput(notification: JsonRpcNotification): void {
    const params = notification.params as
      | {
          delta?: string;
          threadId?: string;
          turnId?: string;
        }
      | undefined;
    const record = this.getRecordFromContext(params?.threadId, params?.turnId);

    if (!record || !params?.delta) {
      return;
    }

    applyCommandOutputDelta(record, params.delta);
  }

  private updateItemLifecycle(notification: JsonRpcNotification): void {
    const params = notification.params as
      | {
          item?: ThreadItem;
          threadId?: string;
          turnId?: string;
        }
      | undefined;
    const phase = notification.method === 'item/started' ? 'started' : 'completed';
    const record = this.getRecordFromContext(params?.threadId, params?.turnId);

    if (!record || !params?.item) {
      return;
    }

    applyItemLifecycle(record, params.item, phase, this.toolItemsCounted);
  }

  private updateThreadStatus(notification: JsonRpcNotification): void {
    const params = notification.params as
      | {
          status?: ThreadStatus;
          threadId?: string;
        }
      | undefined;
    const record = this.getRecordFromContext(params?.threadId, undefined);

    if (!record || !params?.status) {
      return;
    }

    applyThreadStatus(record, params.status);
  }

  private updateThreadTokenUsage(notification: JsonRpcNotification): void {
    const params = notification.params as
      | {
          threadId?: string;
          tokenUsage?: ThreadTokenUsage;
          turnId?: string;
        }
      | undefined;
    const record = this.getRecordFromContext(params?.threadId, params?.turnId);

    if (!record || !params?.tokenUsage) {
      return;
    }

    applyTokenUsage(record, params.tokenUsage);
  }

  private updateToolProgress(notification: JsonRpcNotification): void {
    const params = notification.params as
      | {
          message?: string;
          threadId?: string;
          turnId?: string;
        }
      | undefined;
    const record = this.getRecordFromContext(params?.threadId, params?.turnId);

    if (!record || !params?.message) {
      return;
    }

    applyToolProgress(record, params.message);
  }

  private updateTurnCompleted(notification: JsonRpcNotification): void {
    const params = notification.params as
      | {
          threadId?: string;
          turn?: { id: string };
        }
      | undefined;
    const turnId = params?.turn?.id;
    const record = this.getRecordFromContext(params?.threadId, turnId);

    if (!record || !turnId) {
      return;
    }

    applyTurnCompleted(record, turnId);
    this.turnToWorkspace.delete(turnId);
  }

  private updateTurnDiff(notification: JsonRpcNotification): void {
    const params = notification.params as
      | {
          diff?: string;
          threadId?: string;
          turnId?: string;
        }
      | undefined;
    const record = this.getRecordFromContext(params?.threadId, params?.turnId);

    if (!record || !params?.diff) {
      return;
    }

    applyTurnDiff(record, params.diff);
  }

  private updateTurnPlan(notification: JsonRpcNotification): void {
    const params = notification.params as
      | {
          explanation?: string | null;
          plan?: TurnPlanStep[];
          threadId?: string;
          turnId?: string;
        }
      | undefined;
    const record = this.getRecordFromContext(params?.threadId, params?.turnId);

    if (!record || !params?.plan) {
      return;
    }

    applyTurnPlan(record, params.explanation, params.plan);
  }

  private updateTurnStarted(notification: JsonRpcNotification): void {
    const params = notification.params as
      | {
          threadId?: string;
          turn?: { id: string };
        }
      | undefined;
    const threadId = params?.threadId;
    const turnId = params?.turn?.id;
    const workspaceCwd = threadId ? this.threadToWorkspace.get(threadId) : undefined;

    if (!workspaceCwd || !threadId || !turnId) {
      return;
    }

    this.registerTurn({
      threadId,
      turnId,
      workspaceCwd
    });
  }

  private getRecordFromContext(
    threadId: string | undefined,
    turnId: string | undefined
  ): WorkspaceRuntimeRecord | undefined {
    const workspaceCwd = this.resolveWorkspace(threadId, turnId);

    return workspaceCwd ? this.getOrCreateRecord(workspaceCwd) : undefined;
  }

  private resolveWorkspace(
    threadId: string | undefined,
    turnId: string | undefined
  ): string | undefined {
    if (turnId) {
      const fromTurn = this.turnToWorkspace.get(turnId);

      if (fromTurn) {
        return fromTurn;
      }
    }

    return threadId ? this.threadToWorkspace.get(threadId) : undefined;
  }
}
