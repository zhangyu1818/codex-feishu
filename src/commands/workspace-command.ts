export type ParsedWorkspaceCommand =
  | {
      type: 'show';
    }
  | {
      type: 'use';
      index: number;
    }
  | {
      type: 'add';
      folder: string;
    };

export const WORKSPACE_COMMAND_USAGE =
  'Usage: `/workspace use {n}` or `/workspace add {folder}`';

export const parseWorkspaceCommand = (
  argument?: string
): ParsedWorkspaceCommand => {
  const trimmed = argument?.trim();

  if (!trimmed) {
    return { type: 'show' };
  }

  const parts = trimmed.split(/\s+/);
  const [action, rawValue, extra] = parts;

  if (action === 'use' && rawValue && !extra) {
    const index = Number.parseInt(rawValue, 10);

    if (Number.isInteger(index) && index > 0) {
      return { type: 'use', index };
    }
  }

  if (action !== 'add' || !rawValue || extra) {
    throw new Error(WORKSPACE_COMMAND_USAGE);
  }

  return { type: 'add', folder: rawValue };
};
