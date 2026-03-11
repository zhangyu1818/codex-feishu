import { describe, expect, it } from 'vitest';

import { parseModeCommand } from '../src/commands/mode-command.js';

describe('parseModeCommand', () => {
  it('shows mode when no argument is provided', () => {
    expect(parseModeCommand(undefined)).toEqual({
      type: 'show'
    });
  });

  it('accepts the supported collaboration modes', () => {
    expect(parseModeCommand('plan')).toEqual({
      type: 'set',
      mode: 'plan'
    });
    expect(parseModeCommand('default')).toEqual({
      type: 'set',
      mode: 'default'
    });
  });

  it('rejects unsupported modes', () => {
    expect(() => parseModeCommand('auto')).toThrow(/default|plan/i);
  });
});
