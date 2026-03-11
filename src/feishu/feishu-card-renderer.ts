import type { InteractiveCard } from '@larksuiteoapi/node-sdk';

export type FeishuCardTemplate =
  | 'blue'
  | 'green'
  | 'grey'
  | 'orange'
  | 'red'
  | 'turquoise'
  | 'wathet';

export type CardRenderInput = {
  content: string;
  template?: FeishuCardTemplate;
  title: string;
};

export const renderFeishuCard = ({
  title,
  content,
  template = 'blue'
}: CardRenderInput): string => {
  const card: InteractiveCard = {
    config: {
      wide_screen_mode: true
    },
    header: {
      template,
      title: {
        tag: 'plain_text',
        content: title
      }
    },
    elements: [
      {
        tag: 'markdown',
        content
      }
    ]
  };

  return JSON.stringify(card);
};
