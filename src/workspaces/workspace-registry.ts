import { mkdir } from 'node:fs/promises';

import type { WorkspaceSessionService } from '../bot/workspace-session-service.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { resolveWorkspaceDirectory } from './workspace-paths.js';

export type WorkspaceRegistrationResult = {
  cwd: string;
  displayName: string;
  threadId: string;
};

export class WorkspaceRegistry {
  private readonly config: RuntimeConfig;
  private readonly workspaceSessions: WorkspaceSessionService;

  constructor(options: {
    config: RuntimeConfig;
    workspaceSessions: WorkspaceSessionService;
  }) {
    this.config = options.config;
    this.workspaceSessions = options.workspaceSessions;
  }

  public async addWorkspace(
    folder: string
  ): Promise<WorkspaceRegistrationResult> {
    const rootDir = this.config.workspaces.rootDir;

    if (!rootDir) {
      throw new Error('A workspace root must be configured before using `/workspace add`.');
    }

    const cwd = resolveWorkspaceDirectory(rootDir, folder);
    await mkdir(cwd, { recursive: true });
    const threadId = await this.workspaceSessions.ensureWorkspaceThread(cwd, true);
    await this.workspaceSessions.activateWorkspace(cwd);

    return {
      cwd,
      displayName: await this.workspaceSessions.getWorkspaceDisplayName(cwd),
      threadId
    };
  }
}
