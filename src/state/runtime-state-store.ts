import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { z } from 'zod';
import type { ModeKind } from '../generated/codex-protocol/ModeKind.js';

export type WorkspaceRuntimeState = {
  activeTurnId?: string | undefined;
  lastTurnStatus?: string | undefined;
  modeKind: ModeKind;
  threadId: string;
};

export type RuntimeState = {
  activeWorkspaceCwd: string | null;
  workspaceThreads: Record<string, WorkspaceRuntimeState>;
};

const workspaceRuntimeStateSchema = z.object({
  activeTurnId: z.string().min(1).optional(),
  lastTurnStatus: z.string().min(1).optional(),
  modeKind: z.enum(['default', 'plan']),
  threadId: z.string().min(1)
});

const runtimeStateSchema = z.object({
  activeWorkspaceCwd: z.string().min(1).nullable(),
  workspaceThreads: z.record(z.string(), workspaceRuntimeStateSchema)
});

const cloneState = (state: RuntimeState): RuntimeState => ({
  activeWorkspaceCwd: state.activeWorkspaceCwd,
  workspaceThreads: { ...state.workspaceThreads }
});

export const createEmptyRuntimeState = (): RuntimeState => ({
  activeWorkspaceCwd: null,
  workspaceThreads: {}
});

export const setActiveThreadForWorkspace = (
  state: RuntimeState,
  workspaceCwd: string,
  threadId: string
): RuntimeState => {
  const nextState = cloneState(state);
  const current = nextState.workspaceThreads[workspaceCwd];

  nextState.workspaceThreads[workspaceCwd] = {
    activeTurnId: current?.activeTurnId,
    lastTurnStatus: current?.lastTurnStatus,
    modeKind: current?.modeKind ?? 'default',
    ...current,
    threadId
  };

  return nextState;
};

export const updateWorkspaceTurnState = (
  state: RuntimeState,
  workspaceCwd: string,
  turnState: {
    activeTurnId?: string | undefined;
    lastTurnStatus?: string | undefined;
  }
): RuntimeState => {
  const nextState = cloneState(state);
  const current = nextState.workspaceThreads[workspaceCwd];

  if (!current) {
    throw new Error(`Workspace has no active thread: ${workspaceCwd}`);
  }

  nextState.workspaceThreads[workspaceCwd] = {
    ...current,
    ...turnState
  };

  return nextState;
};

export const getWorkspaceMode = (
  state: RuntimeState,
  workspaceCwd: string
): ModeKind => state.workspaceThreads[workspaceCwd]?.modeKind ?? 'default';

export const setWorkspaceMode = (
  state: RuntimeState,
  workspaceCwd: string,
  modeKind: ModeKind
): RuntimeState => {
  const nextState = cloneState(state);
  const current = nextState.workspaceThreads[workspaceCwd];

  if (!current) {
    throw new Error(`Workspace has no active thread: ${workspaceCwd}`);
  }

  nextState.workspaceThreads[workspaceCwd] = {
    ...current,
    modeKind
  };

  return nextState;
};

export const switchActiveWorkspace = (
  state: RuntimeState,
  workspaceCwd: string
): RuntimeState => ({
  ...cloneState(state),
  activeWorkspaceCwd: workspaceCwd
});

export const readRuntimeState = async (filePath: string): Promise<RuntimeState> => {
  try {
    const raw = await readFile(filePath, 'utf8');

    return runtimeStateSchema.parse(JSON.parse(raw) as unknown);
  } catch (error) {
    const maybeNodeError = error as NodeJS.ErrnoException;

    if (maybeNodeError.code === 'ENOENT') {
      return createEmptyRuntimeState();
    }

    throw error;
  }
};

export const normalizeRuntimeState = (
  rawState: RuntimeState
): RuntimeState => {
  const workspaceThreads = Object.fromEntries(
    Object.entries(rawState.workspaceThreads).map(([cwd, workspace]) => [
      cwd,
      {
        ...workspace,
        modeKind: workspace.modeKind
      }
    ])
  );

  return {
    activeWorkspaceCwd: rawState.activeWorkspaceCwd,
    workspaceThreads
  };
};

export const writeRuntimeState = async (
  filePath: string,
  state: RuntimeState
): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
};
