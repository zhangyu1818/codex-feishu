import { describe, expect, it } from 'vitest';

import { resolveWorkspaceDirectory } from '../src/workspaces/workspace-paths.js';

describe('resolveWorkspaceDirectory', () => {
  it('uses the requested folder as the target directory name', () => {
    expect(resolveWorkspaceDirectory('/tmp/root', 'sandbox')).toBe(
      '/tmp/root/sandbox'
    );
  });

  it('supports an explicit relative folder name', () => {
    expect(resolveWorkspaceDirectory('/tmp/root', 'nested/demo')).toBe(
      '/tmp/root/nested/demo'
    );
  });

  it('rejects absolute paths and traversal outside the configured root', () => {
    expect(() =>
      resolveWorkspaceDirectory('/tmp/root', '/tmp/other')
    ).toThrow(/relative/i);
    expect(() =>
      resolveWorkspaceDirectory('/tmp/root', '../escape')
    ).toThrow(/inside/i);
  });
});
