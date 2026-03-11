export type ParsedIncomingText =
  | {
      type: 'command';
      command: string;
      argument?: string;
    }
  | {
      type: 'prompt';
      text: string;
    };

export const parseIncomingText = (input: string): ParsedIncomingText => {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('Empty message');
  }

  if (!trimmed.startsWith('/')) {
    return {
      type: 'prompt',
      text: trimmed
    };
  }

  const [rawCommand, ...rest] = trimmed.slice(1).split(/\s+/);
  const command = rawCommand?.trim();

  if (!command) {
    throw new Error('Empty command');
  }

  const argument = rest.join(' ').trim();

  return {
    type: 'command',
    command,
    ...(argument ? { argument } : {})
  };
};
