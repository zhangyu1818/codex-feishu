import type { ThreadItem } from '../generated/codex-protocol/v2/ThreadItem.js';
import type { ThreadStatus } from '../generated/codex-protocol/v2/ThreadStatus.js';
import type { ThreadTokenUsage } from '../generated/codex-protocol/v2/ThreadTokenUsage.js';
import type { TurnPlanStep } from '../generated/codex-protocol/v2/TurnPlanStep.js';
import type { WorkspaceRuntimeRecord } from './turn-runtime-status-model.js';

const MAX_RECENT_ACTIVITY = 6;
const MAX_RECENT_TOOLS = 5;
const MAX_COMMAND_OUTPUT = 240;

const pushRecent = (
  values: string[],
  value: string,
  limit: number
): string[] => [...values.slice(-(limit - 1)), value];

const trimOutput = (value: string): string =>
  value.length > MAX_COMMAND_OUTPUT
    ? value.slice(-MAX_COMMAND_OUTPUT)
    : value;

const summarizeDiff = (diff: string): string | undefined => {
  if (!diff.trim()) {
    return undefined;
  }

  const fileCount = diff.split('\ndiff --git ').length - 1 || 1;
  const hunkCount = (diff.match(/^@@/gm) ?? []).length;

  return `${fileCount} file${fileCount === 1 ? '' : 's'} changed across ${hunkCount} hunk${
    hunkCount === 1 ? '' : 's'
  }`;
};

const formatThreadStatus = (status: ThreadStatus): {
  activeFlags: string[];
  label: string;
} => {
  if (status.type !== 'active') {
    return {
      label: status.type,
      activeFlags: []
    };
  }

  return {
    label: 'active',
    activeFlags: status.activeFlags
  };
};

const isToolItem = (item: ThreadItem): boolean =>
  item.type === 'dynamicToolCall' ||
  item.type === 'imageView' ||
  item.type === 'mcpToolCall' ||
  item.type === 'webSearch';

const getToolLabel = (item: ThreadItem): string | null => {
  if (item.type === 'mcpToolCall') {
    return `${item.server}.${item.tool}`;
  }

  if (item.type === 'dynamicToolCall') {
    return item.tool;
  }

  if (item.type === 'imageView') {
    return `image:${item.path}`;
  }

  if (item.type === 'webSearch') {
    return `web:${item.query}`;
  }

  return null;
};

const describeItemActivity = (
  item: ThreadItem,
  phase: 'started' | 'completed'
): string | null => {
  switch (item.type) {
    case 'commandExecution':
      return `Command ${phase}: \`${item.command}\``;
    case 'fileChange':
      return `File change ${phase}: ${item.status}`;
    case 'mcpToolCall':
      return `Tool ${phase}: \`${item.server}.${item.tool}\``;
    case 'dynamicToolCall':
      return `Tool ${phase}: \`${item.tool}\``;
    case 'webSearch':
      return `Web search ${phase}: \`${item.query}\``;
    default:
      return null;
  }
};

export const applyCommandOutputDelta = (
  record: WorkspaceRuntimeRecord,
  delta: string
): void => {
  record.lastCommandOutput = trimOutput(`${record.lastCommandOutput ?? ''}${delta}`);
};

export const applyItemLifecycle = (
  record: WorkspaceRuntimeRecord,
  item: ThreadItem,
  phase: 'started' | 'completed',
  countedToolItems: Set<string>
): void => {
  const activity = describeItemActivity(item, phase);

  if (activity) {
    record.recentActivity = pushRecent(
      record.recentActivity,
      activity,
      MAX_RECENT_ACTIVITY
    );
  }

  if (isToolItem(item)) {
    const label = getToolLabel(item);

    if (label) {
      record.recentTools = pushRecent(record.recentTools, label, MAX_RECENT_TOOLS);
    }

    if (!countedToolItems.has(item.id)) {
      countedToolItems.add(item.id);
      record.toolCallCount += 1;
    }
  }

  if (phase === 'completed' && item.type === 'commandExecution' && item.aggregatedOutput) {
    record.lastCommandOutput = trimOutput(item.aggregatedOutput);
  }
};

export const applyServerRequestActivity = (
  record: WorkspaceRuntimeRecord,
  text: string
): void => {
  record.recentActivity = pushRecent(record.recentActivity, text, MAX_RECENT_ACTIVITY);
};

export const applyThreadStatus = (
  record: WorkspaceRuntimeRecord,
  status: ThreadStatus
): void => {
  const formatted = formatThreadStatus(status);

  record.threadActiveFlags = formatted.activeFlags;
  record.threadStatus = formatted.label;
};

export const applyTokenUsage = (
  record: WorkspaceRuntimeRecord,
  tokenUsage: ThreadTokenUsage
): void => {
  record.tokenUsage = tokenUsage;
};

export const applyToolProgress = (
  record: WorkspaceRuntimeRecord,
  message: string
): void => {
  record.recentActivity = pushRecent(
    record.recentActivity,
    `Tool progress: ${message}`,
    MAX_RECENT_ACTIVITY
  );
};

export const applyTurnCompleted = (
  record: WorkspaceRuntimeRecord,
  turnId: string
): void => {
  if (record.activeTurnId === turnId && record.turnStartedAtMs) {
    record.lastTurnDurationMs = Date.now() - record.turnStartedAtMs;
    record.activeTurnId = undefined;
    record.turnStartedAtMs = undefined;
  }
};

export const applyTurnDiff = (
  record: WorkspaceRuntimeRecord,
  diff: string
): void => {
  record.diffSummary = summarizeDiff(diff);
};

export const applyTurnPlan = (
  record: WorkspaceRuntimeRecord,
  explanation: string | null | undefined,
  plan: TurnPlanStep[]
): void => {
  record.planExplanation = explanation ?? null;
  record.planSteps = [...plan];
};
