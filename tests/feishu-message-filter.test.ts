import { describe, expect, it } from 'vitest';

import { normalizeFeishuTextMessage } from '../src/feishu/feishu-message-filter.js';

describe('normalizeFeishuTextMessage', () => {
  it('accepts private text messages', () => {
    const message = normalizeFeishuTextMessage({
      sender: {
        sender_id: {
          open_id: 'ou_allowed'
        }
      },
      message: {
        chat_id: 'oc_chat',
        chat_type: 'p2p',
        content: JSON.stringify({ text: 'Run tests' }),
        message_id: 'om_123',
        message_type: 'text'
      }
    });

    expect(message).toEqual({
      chatId: 'oc_chat',
      messageId: 'om_123',
      text: 'Run tests'
    });
  });

  it('rejects group chats', () => {
    expect(
      normalizeFeishuTextMessage({
        sender: {
          sender_id: {
            open_id: 'ou_other'
          }
        },
        message: {
          chat_id: 'oc_chat',
          chat_type: 'group',
          content: JSON.stringify({ text: 'Nope' }),
          message_id: 'om_123',
          message_type: 'text'
        }
      })
    ).toBeNull();
  });
});
