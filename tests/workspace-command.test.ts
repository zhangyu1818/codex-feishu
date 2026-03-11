import { describe, expect, it } from 'vitest';

import {
  parseWorkspaceCommand,
  WORKSPACE_COMMAND_USAGE
} from '../src/commands/workspace-command.js';

describe('parseWorkspaceCommand', () => {
  it('shows workspace info when no argument is provided', () => {
    expect(parseWorkspaceCommand()).toEqual({ type: 'show' });
  });

  it('parses workspace use commands with an index', () => {
    expect(parseWorkspaceCommand('use 2')).toEqual({
      type: 'use',
      index: 2
    });
  });

  it('parses workspace add commands with a folder name', () => {
    expect(parseWorkspaceCommand('add sandbox')).toEqual({
      type: 'add',
      folder: 'sandbox'
    });
  });

  it('rejects invalid workspace commands', () => {
    expect(() => parseWorkspaceCommand('remove sandbox')).toThrow(
      WORKSPACE_COMMAND_USAGE
    );
  });

  it('rejects workspace use commands without an index', () => {
    expect(() => parseWorkspaceCommand('use')).toThrow(WORKSPACE_COMMAND_USAGE);
  });

  it('rejects workspace add commands with extra arguments', () => {
    expect(() => parseWorkspaceCommand('add sandbox extra')).toThrow(
      WORKSPACE_COMMAND_USAGE
    );
  });
});
