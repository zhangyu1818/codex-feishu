import type { ModeKind } from '../generated/codex-protocol/ModeKind.js';
import type { Thread } from '../generated/codex-protocol/v2/Thread.js';
import type { ThreadReadResponse } from '../generated/codex-protocol/v2/ThreadReadResponse.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import type { CodexAppServer } from '../codex/codex-app-server.js';
import type {
  RuntimeState,
  WorkspaceRuntimeState
} from '../state/runtime-state-store.js';
import {
  createEmptyRuntimeState,
  getWorkspaceMode,
  normalizeRuntimeState,
  setWorkspaceMode,
  readRuntimeState,
  setActiveThreadForWorkspace,
  switchActiveWorkspace,
  updateWorkspaceTurnState,
  writeRuntimeState
} from '../state/runtime-state-store.js';
import { createThreadsCard, type BotCard } from './card-content.js';
import type { WorkspaceRuntimeStatus } from './turn-runtime-status-store.js';
import {
  buildWorkspaceListEntries,
  type WorkspaceListEntry
} from '../workspaces/workspace-list.js';
import { buildWorkspaceTurnStartConfig } from './workspace-turn-config.js';
import {
  findLatestThreadIdForWorkspace,
  findLatestWorkspaceCwd,
  listDiscoveredWorkspaceCwds
} from './workspace-history.js';
import {
  resumeWorkspaceThread,
  startWorkspaceThread
} from './workspace-thread-lifecycle.js';
import { requireWorkspaceCwd } from './workspace-selection.js';
import {
  createWorkspaceListCard,
  createWorkspaceStatusCard,
  getWorkspaceDisplayName
} from './workspace-cards.js';

type WorkspaceSessionServiceOptions = {
  codex: CodexAppServer;
  codexVersion: string;
  config: RuntimeConfig;
  stateFilePath: string;
};

export class WorkspaceSessionService {
  private readonly codex: CodexAppServer;
  private readonly codexVersion: string;
  private readonly config: RuntimeConfig;
  private readonly loadedThreadIds = new Set<string>();
  private readonly stateFilePath: string;
  private readonly workspaceModels = new Map<string, string>();
  private state: RuntimeState = createEmptyRuntimeState();

  constructor(options: WorkspaceSessionServiceOptions) {
    this.codex = options.codex;
    this.codexVersion = options.codexVersion;
    this.config = options.config;
    this.stateFilePath = options.stateFilePath;
  }

  public async load(): Promise<void> {
    const loaded = await readRuntimeState(this.stateFilePath);

    this.state = normalizeRuntimeState(loaded);

    if (!this.state.activeWorkspaceCwd) {
      const latestWorkspaceCwd = await findLatestWorkspaceCwd(this.codex);

      if (latestWorkspaceCwd) {
        this.state = switchActiveWorkspace(this.state, latestWorkspaceCwd);
      }
    }

    await this.saveState(this.state);
  }

  public getCurrentWorkspaceCwd(): string | null {
    return this.state.activeWorkspaceCwd;
  }

  public getCurrentWorkspaceState(): WorkspaceRuntimeState | undefined {
    const currentWorkspaceCwd = this.getCurrentWorkspaceCwd();

    return currentWorkspaceCwd
      ? this.state.workspaceThreads[currentWorkspaceCwd]
      : undefined;
  }

  public async getWorkspaceDisplayName(cwd: string): Promise<string> {
    return getWorkspaceDisplayName(await this.listWorkspaceEntries(), cwd);
  }

  public async getWorkspacesCard(): Promise<BotCard> {
    return createWorkspaceListCard({
      activeWorkspaceCwd: this.getCurrentWorkspaceCwd(),
      entries: await this.listWorkspaceEntries(),
      ...(this.config.workspaces.rootDir
        ? { rootDirLabel: this.config.workspaces.rootDir }
        : {})
    });
  }

  public async getStatusCard(
    runtime?: WorkspaceRuntimeStatus
  ): Promise<BotCard> {
    const currentWorkspaceCwd = this.getCurrentWorkspaceCwd();

    return createWorkspaceStatusCard({
      codexVersion: this.codexVersion,
      currentWorkspaceCwd,
      currentWorkspaceName: currentWorkspaceCwd
        ? await this.getWorkspaceDisplayName(currentWorkspaceCwd)
        : null,
      modeKind: currentWorkspaceCwd ? this.getCurrentWorkspaceMode() : 'default',
      runtime,
      workspaceState: this.getCurrentWorkspaceState()
    });
  }

  public getCurrentWorkspaceMode(): ModeKind {
    const currentWorkspaceCwd = this.getCurrentWorkspaceCwd();

    return currentWorkspaceCwd
      ? getWorkspaceMode(this.state, currentWorkspaceCwd)
      : 'default';
  }

  public getTurnStartConfig(workspaceCwd: string): {
    cwd: string;
    model?: string;
  } {
    return buildWorkspaceTurnStartConfig({
      modeKind: getWorkspaceMode(this.state, workspaceCwd),
      workspaceCwd,
      workspaceModel: this.workspaceModels.get(workspaceCwd)
    });
  }

  public async activateWorkspace(workspaceCwd: string): Promise<void> {
    await this.saveState(switchActiveWorkspace(this.state, workspaceCwd));
  }

  public async setCurrentWorkspaceMode(modeKind: ModeKind): Promise<void> {
    const currentWorkspaceCwd = requireWorkspaceCwd(this.getCurrentWorkspaceCwd());

    await this.ensureWorkspaceThread(currentWorkspaceCwd, true);
    await this.saveState(
      setWorkspaceMode(this.state, currentWorkspaceCwd, modeKind)
    );
  }

  public async switchWorkspace(workspaceCwd: string): Promise<void> {
    await this.ensureWorkspaceThread(workspaceCwd, true);
    await this.activateWorkspace(workspaceCwd);
  }

  public async selectWorkspaceByIndex(index: number): Promise<WorkspaceListEntry | null> {
    const entries = await this.listWorkspaceEntries();
    const selected = entries[index - 1];

    if (!selected) {
      return null;
    }

    await this.switchWorkspace(selected.cwd);
    return selected;
  }

  public async createFreshThread(
    workspaceCwd = requireWorkspaceCwd(this.getCurrentWorkspaceCwd())
  ): Promise<string> {
    const started = await startWorkspaceThread({
      codex: this.codex,
      serviceName: this.config.serviceName,
      workspaceCwd,
      workspaceModels: this.workspaceModels
    });
    const withThread = setActiveThreadForWorkspace(this.state, workspaceCwd, started.thread.id);
    const nextState = updateWorkspaceTurnState(withThread, workspaceCwd, {
      activeTurnId: undefined,
      lastTurnStatus: 'idle'
    });

    this.loadedThreadIds.add(started.thread.id);
    await this.saveState(nextState);

    return started.thread.id;
  }

  public async ensureWorkspaceThread(
    workspaceCwd: string,
    createIfMissing: boolean
  ): Promise<string> {
    const existingThreadId = this.state.workspaceThreads[workspaceCwd]?.threadId;

    if (existingThreadId) {
      if (!this.loadedThreadIds.has(existingThreadId)) {
        await this.resumeThreadState(workspaceCwd, existingThreadId);
      }

      return existingThreadId;
    }

    const latestThreadId = await findLatestThreadIdForWorkspace(
      this.codex,
      workspaceCwd
    );

    if (latestThreadId) {
      await this.resumeThreadState(workspaceCwd, latestThreadId);
      return latestThreadId;
    }

    if (!createIfMissing) {
      throw new Error(`Workspace has no thread: ${workspaceCwd}`);
    }

    return this.createFreshThread(workspaceCwd);
  }

  public async interruptActiveTurn(): Promise<string | null> {
    const workspaceState = this.getCurrentWorkspaceState();

    if (!workspaceState?.threadId || !workspaceState.activeTurnId) {
      return null;
    }

    await this.codex.interruptTurn(workspaceState.threadId, workspaceState.activeTurnId);
    return workspaceState.activeTurnId;
  }

  public async listThreads(limit = 10): Promise<Thread[]> {
    const currentWorkspaceCwd = this.getCurrentWorkspaceCwd();

    if (!currentWorkspaceCwd) {
      return [];
    }

    const response = await this.codex.listThreads({
      cwd: currentWorkspaceCwd,
      limit
    });

    return response.data;
  }

  public async selectThreadByIndex(index: number): Promise<Thread | null> {
    const currentWorkspaceCwd = this.getCurrentWorkspaceCwd();

    if (!currentWorkspaceCwd) {
      return null;
    }

    const threads = await this.listThreads();
    const selected = threads[index - 1];

    if (!selected) {
      return null;
    }

    await this.resumeThreadState(currentWorkspaceCwd, selected.id);
    return selected;
  }

  public createThreadsCard(threads: Thread[]): BotCard {
    return createThreadsCard(threads, this.getCurrentWorkspaceState()?.threadId);
  }

  public async readThreadByIndex(index: number): Promise<{
    isActive: boolean;
    response: ThreadReadResponse;
  } | null> {
    if (!this.getCurrentWorkspaceCwd()) {
      return null;
    }

    const threads = await this.listThreads();
    const selected = threads[index - 1];

    if (!selected) {
      return null;
    }

    return {
      response: await this.codex.readThread(selected.id),
      isActive: this.getCurrentWorkspaceState()?.threadId === selected.id
    };
  }

  public async markTurnStarted(turnId: string, status: string): Promise<void> {
    const currentWorkspaceCwd = requireWorkspaceCwd(this.getCurrentWorkspaceCwd());

    await this.saveState(
      updateWorkspaceTurnState(this.state, currentWorkspaceCwd, {
        activeTurnId: turnId,
        lastTurnStatus: status
      })
    );
  }

  public async markTurnCompleted(input: {
    status: string;
    workspaceCwd: string;
  }): Promise<void> {
    await this.saveState(
      updateWorkspaceTurnState(this.state, input.workspaceCwd, {
        activeTurnId: undefined,
        lastTurnStatus: input.status
      })
    );
  }

  private async listWorkspaceEntries(): Promise<WorkspaceListEntry[]> {
    return buildWorkspaceListEntries({
      activeWorkspaceCwd: this.getCurrentWorkspaceCwd(),
      discovered: await listDiscoveredWorkspaceCwds(this.codex)
    });
  }

  private async resumeThreadState(workspaceCwd: string, threadId: string): Promise<void> {
    await resumeWorkspaceThread({
      codex: this.codex,
      serviceName: this.config.serviceName,
      threadId,
      workspaceCwd,
      workspaceModels: this.workspaceModels
    });

    this.loadedThreadIds.add(threadId);
    const withThread = setActiveThreadForWorkspace(this.state, workspaceCwd, threadId);

    await this.saveState(
      updateWorkspaceTurnState(withThread, workspaceCwd, {
        activeTurnId: undefined,
        lastTurnStatus: 'idle'
      })
    );
  }

  private async saveState(nextState: RuntimeState): Promise<void> {
    this.state = nextState;
    await writeRuntimeState(this.stateFilePath, nextState);
  }
}
