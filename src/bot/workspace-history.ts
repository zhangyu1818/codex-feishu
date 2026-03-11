import type { CodexAppServer } from '../codex/codex-app-server.js';

export const findLatestThreadIdForWorkspace = async (
  codex: CodexAppServer,
  workspaceCwd: string
): Promise<string | null> => {
  const response = await codex.listThreads({
    cwd: workspaceCwd,
    limit: 1
  });

  return response.data[0]?.id ?? null;
};

export const findLatestWorkspaceCwd = async (
  codex: CodexAppServer
): Promise<string | null> => {
  const response = await codex.listThreads({
    limit: 1
  });

  return response.data[0]?.cwd ?? null;
};

export const listDiscoveredWorkspaceCwds = async (
  codex: CodexAppServer,
  limit = 100
): Promise<string[]> => {
  const response = await codex.listThreads({ limit });
  const seen = new Set<string>();
  const discovered: string[] = [];

  for (const thread of response.data) {
    if (!thread.cwd || seen.has(thread.cwd)) {
      continue;
    }

    seen.add(thread.cwd);
    discovered.push(thread.cwd);
  }

  return discovered;
};
