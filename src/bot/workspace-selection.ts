export const requireWorkspaceCwd = (workspaceCwd: string | null): string => {
  if (!workspaceCwd) {
    throw new Error(
      'No workspace selected. Use `/workspaces` to choose one or `/workspace add {folder}` to create one.'
    );
  }

  return workspaceCwd;
};
