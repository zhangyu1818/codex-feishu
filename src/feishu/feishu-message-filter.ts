export type FeishuMessageReceiveEvent = {
  message: {
    chat_id: string;
    chat_type: string;
    content: string;
    message_id: string;
    message_type: string;
  };
  sender: {
    sender_id?: {
      open_id?: string;
    };
  };
};

export type FeishuTextMessage = {
  chatId: string;
  messageId: string;
  text: string;
};

const parseTextContent = (content: string): string => {
  const parsed = JSON.parse(content) as { text?: string };
  const text = parsed.text?.trim();

  if (!text) {
    throw new Error('Feishu text payload is empty');
  }

  return text;
};

export const normalizeFeishuTextMessage = (
  event: FeishuMessageReceiveEvent
): FeishuTextMessage | null => {
  if (event.message.chat_type !== 'p2p') {
    return null;
  }

  if (event.message.message_type !== 'text') {
    return null;
  }

  return {
    chatId: event.message.chat_id,
    messageId: event.message.message_id,
    text: parseTextContent(event.message.content)
  };
};
