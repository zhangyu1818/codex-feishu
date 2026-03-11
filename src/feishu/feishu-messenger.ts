import { Client } from '@larksuiteoapi/node-sdk';

import {
  renderFeishuCard,
  type CardRenderInput
} from './feishu-card-renderer.js';

type FeishuMessengerOptions = {
  appId: string;
  appSecret: string;
};

const assertResponse = (
  response: { code?: number | undefined; msg?: string | undefined },
  action: string
): void => {
  if (!response.code || response.code === 0) {
    return;
  }

  throw new Error(`Feishu ${action} failed: ${response.msg ?? response.code}`);
};

export class FeishuMessenger {
  private readonly client: Client;

  constructor(options: FeishuMessengerOptions) {
    this.client = new Client({
      appId: options.appId,
      appSecret: options.appSecret
    });
  }

  public async replyCard(
    messageId: string,
    card: CardRenderInput
  ): Promise<void> {
    const response = await this.client.im.v1.message.reply({
      path: {
        message_id: messageId
      },
      data: {
        msg_type: 'interactive',
        content: renderFeishuCard(card)
      }
    });

    assertResponse(response, 'reply');
  }

  public async sendCard(chatId: string, card: CardRenderInput): Promise<void> {
    const response = await this.client.im.v1.message.create({
      params: {
        receive_id_type: 'chat_id'
      },
      data: {
        receive_id: chatId,
        msg_type: 'interactive',
        content: renderFeishuCard(card)
      }
    });

    assertResponse(response, 'send');
  }
}
