export type ParsedThreadCommand =
  | {
      type: 'read';
      index: number;
    }
  | {
      type: 'select';
      index: number;
    };

export const THREAD_COMMAND_USAGE =
  'Usage: `/thread {n}` or `/thread read {n}`';

const parsePositiveInteger = (value: string | undefined): number => {
  const index = Number(value);

  if (!Number.isInteger(index) || index < 1) {
    throw new Error(THREAD_COMMAND_USAGE);
  }

  return index;
};

export const parseThreadCommand = (
  argument?: string
): ParsedThreadCommand => {
  const trimmed = argument?.trim();

  if (!trimmed) {
    throw new Error(THREAD_COMMAND_USAGE);
  }

  const [action, maybeIndex, extra] = trimmed.split(/\s+/);

  if (action === 'read') {
    if (extra) {
      throw new Error(THREAD_COMMAND_USAGE);
    }

    return {
      type: 'read',
      index: parsePositiveInteger(maybeIndex)
    };
  }

  if (maybeIndex || extra) {
    throw new Error(THREAD_COMMAND_USAGE);
  }

  return {
    type: 'select',
    index: parsePositiveInteger(action)
  };
};
