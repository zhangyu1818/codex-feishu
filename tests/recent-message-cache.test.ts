import { describe, expect, it } from 'vitest';

import { RecentMessageCache } from '../src/feishu/recent-message-cache.js';

describe('RecentMessageCache', () => {
  it('rejects duplicate message ids until the ttl expires', () => {
    const cache = new RecentMessageCache({
      maxEntries: 10,
      ttlMs: 1_000
    });

    expect(cache.shouldProcess('om_1', 0)).toBe(true);
    expect(cache.shouldProcess('om_1', 500)).toBe(false);
    expect(cache.shouldProcess('om_1', 1_501)).toBe(true);
  });

  it('evicts the oldest ids when the cache grows beyond max entries', () => {
    const cache = new RecentMessageCache({
      maxEntries: 2,
      ttlMs: 60_000
    });

    expect(cache.shouldProcess('om_1', 0)).toBe(true);
    expect(cache.shouldProcess('om_2', 1)).toBe(true);
    expect(cache.shouldProcess('om_3', 2)).toBe(true);
    expect(cache.shouldProcess('om_1', 3)).toBe(true);
  });
});
