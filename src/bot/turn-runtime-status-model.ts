import type { ThreadTokenUsage } from '../generated/codex-protocol/v2/ThreadTokenUsage.js';
import type { TurnPlanStep } from '../generated/codex-protocol/v2/TurnPlanStep.js';

export type WorkspaceRuntimeRecord = {
  activeThreadId: string | undefined;
  activeTurnId: string | undefined;
  diffSummary: string | undefined;
  lastCommandOutput: string | undefined;
  lastTurnDurationMs: number | undefined;
  planExplanation: string | null | undefined;
  planSteps: TurnPlanStep[];
  recentActivity: string[];
  recentTools: string[];
  threadActiveFlags: string[];
  threadStatus: string | undefined;
  tokenUsage: ThreadTokenUsage | undefined;
  toolCallCount: number;
  turnStartedAtMs: number | undefined;
};

export type WorkspaceRuntimeStatus = {
  activeThreadId?: string;
  activeTurnId?: string;
  diffSummary?: string;
  elapsedMs?: number;
  lastCommandOutput?: string;
  lastTurnDurationMs?: number;
  planExplanation?: string | null;
  planSteps: TurnPlanStep[];
  recentActivity: string[];
  recentTools: string[];
  threadActiveFlags: string[];
  threadStatus?: string;
  tokenUsage?: ThreadTokenUsage;
  toolCallCount: number;
};

export const createEmptyRuntimeRecord = (): WorkspaceRuntimeRecord => ({
  activeThreadId: undefined,
  activeTurnId: undefined,
  diffSummary: undefined,
  lastCommandOutput: undefined,
  lastTurnDurationMs: undefined,
  planExplanation: undefined,
  planSteps: [],
  recentActivity: [],
  recentTools: [],
  threadActiveFlags: [],
  threadStatus: undefined,
  tokenUsage: undefined,
  toolCallCount: 0,
  turnStartedAtMs: undefined
});

export const cloneRuntimeStatus = (
  record: WorkspaceRuntimeRecord
): WorkspaceRuntimeStatus => ({
  ...(record.activeThreadId ? { activeThreadId: record.activeThreadId } : {}),
  ...(record.activeTurnId ? { activeTurnId: record.activeTurnId } : {}),
  ...(record.diffSummary ? { diffSummary: record.diffSummary } : {}),
  ...(record.turnStartedAtMs
    ? { elapsedMs: Date.now() - record.turnStartedAtMs }
    : {}),
  ...(record.lastCommandOutput
    ? { lastCommandOutput: record.lastCommandOutput }
    : {}),
  ...(record.lastTurnDurationMs !== undefined
    ? { lastTurnDurationMs: record.lastTurnDurationMs }
    : {}),
  ...(record.planExplanation !== undefined
    ? { planExplanation: record.planExplanation }
    : {}),
  ...(record.threadStatus ? { threadStatus: record.threadStatus } : {}),
  ...(record.tokenUsage ? { tokenUsage: record.tokenUsage } : {}),
  planSteps: [...record.planSteps],
  recentActivity: [...record.recentActivity],
  recentTools: [...record.recentTools],
  threadActiveFlags: [...record.threadActiveFlags],
  toolCallCount: record.toolCallCount
});
