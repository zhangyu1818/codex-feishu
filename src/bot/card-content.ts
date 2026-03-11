import type { ServerRequest } from '../generated/codex-protocol/ServerRequest.js';
import type { Thread } from '../generated/codex-protocol/v2/Thread.js';
import type { ThreadReadResponse } from '../generated/codex-protocol/v2/ThreadReadResponse.js';
import type { JsonRpcNotification } from '../codex/jsonl-rpc-client.js';
import type { FeishuCardTemplate } from '../feishu/feishu-card-renderer.js';
import type { WorkspaceListEntry } from '../workspaces/workspace-list.js';

export type BotCard = {
  content: string;
  template?: FeishuCardTemplate;
  title: string;
};

export const createHelpCard = (): BotCard => ({
  title: 'Feishu Codex Bot',
  content: [
    '`/help` Show commands',
    '`/workspaces` List numbered workspaces',
    '`/workspace` Show workspace commands',
    '`/workspace use {n}` Switch to the numbered workspace from `/workspaces`',
    '`/workspace add {folder}` Create a workspace under the configured root directory',
    '`/mode` Show the current collaboration mode',
    '`/mode {default|plan}` Set the mode for the current workspace',
    '`/new` Create a fresh thread in the current workspace',
    '`/status` Show current workspace and turn state',
    '`/interrupt` Interrupt the active turn',
    '`/threads` List recent threads for the current workspace',
    '`/thread {n}` Select the numbered thread from `/threads`',
    '`/thread read {n}` Show details for the numbered thread from `/threads`',
    'Any non-command text starts a turn or steers the active one.'
  ].join('\n')
});

export const createWorkspacesCard = (input: {
  activeWorkspaceCwd: string | null;
  entries: WorkspaceListEntry[];
  rootDirLabel?: string;
}): BotCard => {
  const activeWorkspace = input.entries.find(
    (entry) => entry.cwd === input.activeWorkspaceCwd
  );
  const lines =
    input.entries.length === 0
      ? ['No workspaces found.']
      : input.entries.map((entry, index) => {
          return [
            `${index + 1}. \`${entry.displayName}\``,
            `   path: \`${entry.cwd}\``,
            ...(entry.isCurrent ? ['   current'] : [])
          ].join('\n');
        });

  return {
    title: 'Workspaces',
    content: [
      `Current: \`${activeWorkspace?.displayName ?? input.activeWorkspaceCwd ?? 'none'}\``,
      '',
      ...lines,
      '',
      input.rootDirLabel
        ? `New workspaces are created under \`${input.rootDirLabel}\`.`
        : 'New workspace creation is unavailable until a root directory is configured.'
    ].join('\n')
  };
};

export const createNoWorkspaceCard = (title = 'Workspace Required'): BotCard => ({
  title,
  content: [
    'No workspace selected.',
    'Use `/workspaces` to choose a historical workspace or `/workspace add {folder}` to create one.'
  ].join('\n'),
  template: 'grey'
});

export { createStatusCard } from './status-card-content.js';

export const createThreadsCard = (
  threads: Thread[],
  activeThreadId?: string
): BotCard => ({
  title: 'Recent Threads',
  content:
    threads.length === 0
      ? 'No threads found for the current workspace.'
      : threads
          .map((thread, index) => {
            const label = thread.name || thread.preview || `Conversation ${index + 1}`;
            const activeSuffix = thread.id === activeThreadId ? ' (active)' : '';

            return `${index + 1}. \`${label}\`${activeSuffix}`;
          })
          .join('\n')
});

const formatTimestamp = (unixSeconds: number): string =>
  new Date(unixSeconds * 1000).toLocaleString('zh-CN', {
    hour12: false
  });

const formatThreadStatus = (thread: Thread): string => {
  if (thread.status.type !== 'active') {
    return thread.status.type;
  }

  const flags = thread.status.activeFlags.join(', ');
  return flags ? `active (${flags})` : 'active';
};

export const createThreadDetailsCard = (
  response: ThreadReadResponse,
  index: number,
  isActive: boolean
): BotCard => {
  const { thread } = response;
  const label = thread.name || thread.preview || `Conversation ${index}`;
  const turnLines =
    thread.turns.length === 0
      ? ['No turn history loaded.']
      : thread.turns.slice(-8).map((turn, offset) => {
          const turnIndex = thread.turns.length - Math.min(thread.turns.length, 8) + offset + 1;
          const suffix = turn.error?.message ? ` - ${turn.error.message}` : '';

          return `${turnIndex}. ${turn.status}${suffix}`;
        });

  return {
    title: 'Thread Details',
    content: [
      `Index: ${index}`,
      `Title: \`${label}\`${isActive ? ' (active)' : ''}`,
      `Workspace: \`${thread.cwd}\``,
      `Source: \`${typeof thread.source === 'string' ? thread.source : 'subAgent'}\``,
      `Status: ${formatThreadStatus(thread)}`,
      `Created: ${formatTimestamp(thread.createdAt)}`,
      `Updated: ${formatTimestamp(thread.updatedAt)}`,
      '',
      'Recent turns:',
      ...turnLines
    ].join('\n')
  };
};

export const createAckCard = (content: string): BotCard => ({
  title: 'Accepted',
  content,
  template: 'wathet'
});

export const createResultCard = (input: {
  error?: string | null;
  status: string;
  text: string;
}): BotCard => {
  if (input.status === 'completed') {
    return {
      title: 'Turn Completed',
      content: input.text || 'No assistant message was emitted.',
      template: 'green'
    };
  }

  if (input.status === 'interrupted') {
    return {
      title: 'Turn Interrupted',
      content: input.text || 'The active turn was interrupted.',
      template: 'orange'
    };
  }

  return {
    title: 'Turn Failed',
    content: input.error || input.text || 'The turn failed without a message.',
    template: 'red'
  };
};

export const createServerRequestCard = (
  request: ServerRequest
): BotCard | null => {
  switch (request.method) {
    case 'item/commandExecution/requestApproval':
      return {
        title: 'Auto Approved',
        content: 'Command execution was auto-approved.',
        template: 'orange'
      };
    case 'item/fileChange/requestApproval':
      return {
        title: 'Auto Approved',
        content: 'File changes were auto-approved.',
        template: 'orange'
      };
    default:
      return null;
  }
};

export const createNotificationCard = (
  notification: JsonRpcNotification
): BotCard | null => {
  if (notification.method === 'turn/started') {
    return {
      title: 'Turn Started',
      content: 'Codex started working on the request.',
      template: 'blue'
    };
  }

  if (notification.method !== 'item/started' && notification.method !== 'item/completed') {
    return null;
  }

  const params = notification.params as
    | {
        item?: {
          changes?: Array<unknown>;
          command?: string;
          status?: string;
          tool?: string;
          type?: string;
        };
      }
    | undefined;
  const item = params?.item;

  if (!item?.type) {
    return null;
  }

  switch (item.type) {
    case 'commandExecution':
      return {
        title: notification.method === 'item/started' ? 'Command Started' : 'Command Finished',
        content: item.command ? `\`${item.command}\`` : 'Command execution update.'
      };
    case 'fileChange':
      return {
        title: notification.method === 'item/started' ? 'File Change Proposed' : 'File Change Applied',
        content: `Status: ${item.status ?? 'unknown'}`
      };
    case 'mcpToolCall':
      return {
        title: notification.method === 'item/started' ? 'Tool Started' : 'Tool Finished',
        content: item.tool ? `Tool: \`${item.tool}\`` : 'MCP tool update.'
      };
    default:
      return null;
  }
};
