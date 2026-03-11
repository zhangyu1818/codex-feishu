import { describe, expect, it } from 'vitest';

import {
  parseThreadCommand,
  THREAD_COMMAND_USAGE
} from '../src/commands/thread-command.js';

describe('parseThreadCommand', () => {
  it('parses thread selection commands', () => {
    expect(parseThreadCommand('2')).toEqual({
      type: 'select',
      index: 2
    });
  });

  it('parses thread detail commands', () => {
    expect(parseThreadCommand('read 3')).toEqual({
      type: 'read',
      index: 3
    });
  });

  it('rejects malformed thread commands', () => {
    expect(() => parseThreadCommand('read nope')).toThrow(THREAD_COMMAND_USAGE);
  });
});
