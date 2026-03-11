import type { ModeKind } from '../generated/codex-protocol/ModeKind.js';

export const MODE_COMMAND_USAGE =
  '`/mode` Show the current collaboration mode\n`/mode {default|plan}` Set the mode for the current workspace';

export const parseModeCommand = (
  input: string | undefined
):
  | {
      type: 'show';
    }
  | {
      mode: ModeKind;
      type: 'set';
    } => {
  const trimmed = input?.trim();

  if (!trimmed) {
    return {
      type: 'show'
    };
  }

  if (trimmed === 'default' || trimmed === 'plan') {
    return {
      type: 'set',
      mode: trimmed
    };
  }

  throw new Error(MODE_COMMAND_USAGE);
};
