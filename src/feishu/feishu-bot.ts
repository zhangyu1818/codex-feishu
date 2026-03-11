import {
  EventDispatcher,
  WSClient,
  type EventHandles
} from '@larksuiteoapi/node-sdk';

import type { CodexBotController } from '../bot/codex-bot-controller.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import type { FeishuMessageReceiveEvent } from './feishu-message-filter.js';
import { normalizeFeishuTextMessage } from './feishu-message-filter.js';
import type { FeishuMessenger } from './feishu-messenger.js';
import { RecentMessageCache } from './recent-message-cache.js';

export class FeishuBot {
  private readonly controller: CodexBotController;
  private readonly dispatcher = new EventDispatcher({});
  private readonly messenger: FeishuMessenger;
  private readonly recentMessages = new RecentMessageCache({
    maxEntries: 5_000,
    ttlMs: 15 * 60 * 1_000
  });
  private readonly wsClient: WSClient;
  private readonly config: RuntimeConfig;

  constructor(
    config: RuntimeConfig,
    controller: CodexBotController,
    messenger: FeishuMessenger
  ) {
    this.config = config;
    this.controller = controller;
    this.messenger = messenger;
    this.wsClient = new WSClient({
      appId: config.feishu.appId,
      appSecret: config.feishu.appSecret
    });

    this.dispatcher.register({
      'im.message.receive_v1': async (event: FeishuMessageReceiveEvent) => {
        if (!this.recentMessages.shouldProcess(event.message.message_id)) {
          return;
        }

        const message = normalizeFeishuTextMessage(event);

        if (!message) {
          return;
        }

        try {
          await this.controller.handleIncomingMessage(message);
        } catch (error) {
          console.error('[FeishuBot] failed to handle message', error);
          await this.messenger.replyCard(message.messageId, {
            title: 'Error',
            content: String(error instanceof Error ? error.message : error),
            template: 'red'
          });
        }
      }
    } satisfies EventHandles);
  }

  public async start(): Promise<void> {
    await this.wsClient.start({
      eventDispatcher: this.dispatcher
    });
    console.info('[FeishuBot] websocket client started');
  }

  public stop(): void {
    this.wsClient.close({
      force: true
    });
  }
}
