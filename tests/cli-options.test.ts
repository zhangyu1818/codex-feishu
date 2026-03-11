import { describe, expect, it } from 'vitest';

import { parseCliOptions } from '../src/config/cli-options.js';

describe('parseCliOptions', () => {
  it('accepts a config override with -c', () => {
    expect(parseCliOptions(['-c', './bot.config.json'])).toEqual({
      configFilePath: './bot.config.json'
    });
  });

  it('accepts a config override with --config', () => {
    expect(parseCliOptions(['--config', '/tmp/bot.config.json'])).toEqual({
      configFilePath: '/tmp/bot.config.json'
    });
  });

  it('rejects missing values for -c', () => {
    expect(() => parseCliOptions(['-c'])).toThrow(/requires a path/i);
  });
});
