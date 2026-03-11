import { basename } from 'node:path';

import type { WorkspaceRuntimeState } from '../state/runtime-state-store.js';
import {
  createStatusCard,
  createWorkspacesCard,
  type BotCard
} from './card-content.js';
import type { WorkspaceRuntimeStatus } from './turn-runtime-status-store.js';
import type { WorkspaceListEntry } from '../workspaces/workspace-list.js';
import type { ModeKind } from '../generated/codex-protocol/ModeKind.js';

export const getWorkspaceDisplayName = (
  entries: WorkspaceListEntry[],
  cwd: string
): string => entries.find((entry) => entry.cwd === cwd)?.displayName ?? (basename(cwd) || cwd);

export const createWorkspaceListCard = (input: {
  activeWorkspaceCwd: string | null;
  entries: WorkspaceListEntry[];
  rootDirLabel?: string;
}): BotCard =>
  createWorkspacesCard({
    activeWorkspaceCwd: input.activeWorkspaceCwd,
    entries: input.entries,
    ...(input.rootDirLabel ? { rootDirLabel: input.rootDirLabel } : {})
  });

export const createWorkspaceStatusCard = (input: {
  codexVersion: string;
  currentWorkspaceCwd: string | null;
  currentWorkspaceName: string | null;
  modeKind: ModeKind;
  runtime: WorkspaceRuntimeStatus | undefined;
  workspaceState: WorkspaceRuntimeState | undefined;
}): BotCard =>
  createStatusCard({
    activeTurnId: input.workspaceState?.activeTurnId,
    codexVersion: input.codexVersion,
    currentWorkspaceCwd: input.currentWorkspaceCwd,
    currentWorkspaceName: input.currentWorkspaceName,
    modeKind: input.modeKind,
    runtime: input.runtime,
    threadId: input.workspaceState?.threadId,
    turnStatus: input.workspaceState?.lastTurnStatus
  });
