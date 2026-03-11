import { describe, expect, it } from 'vitest';

import { parseCodexVersion } from '../src/codex/codex-binary.js';

describe('parseCodexVersion', () => {
  it('extracts the CLI version from codex --version output', () => {
    expect(parseCodexVersion('codex-cli 0.112.0\n')).toBe('0.112.0');
  });

  it('rejects unexpected output', () => {
    expect(() => {
      parseCodexVersion('0.112.0');
    }).toThrow(/Unexpected codex --version output/);
  });
});
