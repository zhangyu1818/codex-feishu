import type { CollaborationMode } from '../generated/codex-protocol/CollaborationMode.js';
import type { ModeKind } from '../generated/codex-protocol/ModeKind.js';

export const buildWorkspaceTurnStartConfig = (input: {
  modeKind: ModeKind;
  workspaceCwd: string;
  workspaceModel: string | undefined;
}): {
  collaborationMode?: CollaborationMode;
  cwd: string;
  model?: string;
} => {
  if (input.modeKind === 'default') {
    return { cwd: input.workspaceCwd };
  }

  if (!input.workspaceModel) {
    return { cwd: input.workspaceCwd };
  }

  return {
    cwd: input.workspaceCwd,
    model: input.workspaceModel,
    collaborationMode: {
      mode: input.modeKind,
      settings: {
        model: input.workspaceModel,
        reasoning_effort: null,
        developer_instructions: null
      }
    }
  };
};
