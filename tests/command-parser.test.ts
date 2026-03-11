import { describe, expect, it } from 'vitest';

import { parseIncomingText } from '../src/commands/command-parser.js';

describe('parseIncomingText', () => {
  it('parses slash commands with an optional argument', () => {
    expect(parseIncomingText('/workspace use repo')).toEqual({
      type: 'command',
      command: 'workspace',
      argument: 'use repo'
    });
  });

  it('treats regular text as a prompt', () => {
    expect(parseIncomingText('run tests and fix failures')).toEqual({
      type: 'prompt',
      text: 'run tests and fix failures'
    });
  });

  it('rejects empty text after trimming', () => {
    expect(() => parseIncomingText('   ')).toThrow(/empty message/i);
  });
});
