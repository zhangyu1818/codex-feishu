import type { CodexAppServer } from '../codex/codex-app-server.js';

type WorkspaceThreadLifecycleInput = {
  codex: CodexAppServer;
  serviceName: string;
  workspaceCwd: string;
  workspaceModels: Map<string, string>;
};

export const startWorkspaceThread = async (
  input: WorkspaceThreadLifecycleInput
) => {
  const response = await input.codex.startThread({
    cwd: input.workspaceCwd,
    serviceName: input.serviceName
  });

  input.workspaceModels.set(input.workspaceCwd, response.model);
  return response;
};

export const resumeWorkspaceThread = async (
  input: WorkspaceThreadLifecycleInput & {
    threadId: string;
  }
) => {
  const response = await input.codex.resumeThread(input.threadId, {
    cwd: input.workspaceCwd,
    serviceName: input.serviceName
  });

  input.workspaceModels.set(input.workspaceCwd, response.model);
};
