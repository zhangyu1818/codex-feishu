import type { ModeKind } from '../generated/codex-protocol/ModeKind.js';
import type { BotCard } from './card-content.js';
import type { WorkspaceRuntimeStatus } from './turn-runtime-status-store.js';

const formatDuration = (valueMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};

const createEmptyStatusCard = (codexVersion: string): BotCard => ({
  title: 'Status',
  content: [
    `Codex: \`${codexVersion}\``,
    'No workspace selected.',
    'Use `/workspaces` to pick one from history or `/workspace add {folder}` to create one.'
  ].join('\n')
});

const appendRuntimeSections = (
  lines: string[],
  runtime: WorkspaceRuntimeStatus | undefined
): void => {
  if (runtime?.threadStatus) {
    const flags = runtime.threadActiveFlags.length
      ? ` (${runtime.threadActiveFlags.join(', ')})`
      : '';

    lines.push(`Thread runtime: ${runtime.threadStatus}${flags}`);
  }

  if (runtime?.elapsedMs) {
    lines.push(`Elapsed: \`${formatDuration(runtime.elapsedMs)}\``);
  } else if (runtime?.lastTurnDurationMs) {
    lines.push(`Last turn duration: \`${formatDuration(runtime.lastTurnDurationMs)}\``);
  }

  if (runtime?.tokenUsage) {
    lines.push(
      `Last token usage: input ${runtime.tokenUsage.last.inputTokens}, output ${runtime.tokenUsage.last.outputTokens}, total ${runtime.tokenUsage.last.totalTokens}`
    );
  }

  if (runtime?.diffSummary) {
    lines.push(`Diff: ${runtime.diffSummary}`);
  }

  if (runtime && runtime.toolCallCount > 0) {
    lines.push(`Tool calls: ${runtime.toolCallCount}`);
  }

  if (runtime?.recentTools.length) {
    lines.push(
      `Recent tools: ${runtime.recentTools.map((tool) => `\`${tool}\``).join(', ')}`
    );
  }

  if (runtime?.planSteps.length) {
    lines.push('', 'Recent plan:');

    if (runtime.planExplanation) {
      lines.push(runtime.planExplanation);
    }

    lines.push(...runtime.planSteps.slice(0, 4).map((step) => `- [${step.status}] ${step.step}`));
  }

  if (runtime?.recentActivity.length) {
    lines.push('', 'Recent activity:');
    lines.push(...runtime.recentActivity.map((entry) => `- ${entry}`));
  }

  if (runtime?.lastCommandOutput) {
    lines.push('', 'Last command output:', `\`\`\`\n${runtime.lastCommandOutput}\n\`\`\``);
  }
};

export const createStatusCard = (input: {
  activeTurnId: string | undefined;
  codexVersion: string;
  currentWorkspaceCwd: string | null;
  currentWorkspaceName: string | null;
  modeKind: ModeKind;
  runtime: WorkspaceRuntimeStatus | undefined;
  threadId: string | undefined;
  turnStatus: string | undefined;
}): BotCard => {
  if (!input.currentWorkspaceCwd || !input.currentWorkspaceName) {
    return createEmptyStatusCard(input.codexVersion);
  }

  const hasConversation = Boolean(input.runtime?.activeThreadId ?? input.threadId);
  const hasActiveRequest = Boolean(input.runtime?.activeTurnId ?? input.activeTurnId);
  const lines = [
    `Workspace: \`${input.currentWorkspaceName}\``,
    `Path: \`${input.currentWorkspaceCwd}\``,
    `Codex: \`${input.codexVersion}\``,
    `Mode: \`${input.modeKind}\``,
    `Conversation: ${hasConversation ? 'ready' : 'not ready'}`,
    `Request: ${hasActiveRequest ? 'running' : 'idle'}`,
    `Request status: ${input.turnStatus ?? 'idle'}`
  ];

  appendRuntimeSections(lines, input.runtime);

  return {
    title: 'Status',
    content: lines.join('\n')
  };
};
