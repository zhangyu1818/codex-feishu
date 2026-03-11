import { describe, expect, it } from 'vitest';

import { renderFeishuCard } from '../src/feishu/feishu-card-renderer.js';

describe('renderFeishuCard', () => {
  it('renders a markdown card payload', () => {
    const payload = renderFeishuCard({
      title: 'Codex Status',
      content: 'Running in `repo`',
      template: 'green'
    });
    const parsed = JSON.parse(payload) as {
      elements: Array<{ content: string; tag: string }>;
      header: { template: string; title: { content: string } };
    };

    expect(parsed.header.title.content).toBe('Codex Status');
    expect(parsed.header.template).toBe('green');
    expect(parsed.elements[0]).toEqual({
      tag: 'markdown',
      content: 'Running in `repo`'
    });
  });
});
