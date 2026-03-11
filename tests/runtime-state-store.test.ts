import { describe, expect, it } from 'vitest';

import {
  createEmptyRuntimeState,
  getWorkspaceMode,
  setWorkspaceMode,
  normalizeRuntimeState,
  setActiveThreadForWorkspace,
  switchActiveWorkspace
} from '../src/state/runtime-state-store.js';

describe('runtime state store', () => {
  it('tracks one active thread per workspace and active workspace selection', () => {
    const initial = createEmptyRuntimeState();
    const withThread = setActiveThreadForWorkspace(initial, '/tmp/repo', 'thr_123');
    const switched = switchActiveWorkspace(withThread, '/tmp/repo');

    expect(switched.activeWorkspaceCwd).toBe('/tmp/repo');
    expect(switched.workspaceThreads['/tmp/repo']?.threadId).toBe('thr_123');
    expect(switched.workspaceThreads['/tmp/repo']?.modeKind).toBe('default');
  });

  it('keeps the active workspace unset when none is selected yet', () => {
    const normalized = normalizeRuntimeState({
      activeWorkspaceCwd: null,
      workspaceThreads: {
        '/tmp/repo': {
          activeTurnId: undefined,
          lastTurnStatus: 'completed',
          modeKind: 'default',
          threadId: 'thr_456'
        }
      }
    });

    expect(normalized.activeWorkspaceCwd).toBeNull();
    expect(normalized.workspaceThreads['/tmp/repo']?.threadId).toBe('thr_456');
    expect(normalized.workspaceThreads['/tmp/repo']?.modeKind).toBe('default');
  });

  it('tracks workspace collaboration mode independently of threads', () => {
    const withThread = setActiveThreadForWorkspace(
      createEmptyRuntimeState(),
      '/tmp/repo',
      'thr_123'
    );
    const withPlanMode = setWorkspaceMode(withThread, '/tmp/repo', 'plan');

    expect(getWorkspaceMode(withPlanMode, '/tmp/repo')).toBe('plan');
  });
});
