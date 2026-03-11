import {
  MODE_COMMAND_USAGE,
  parseModeCommand
} from '../commands/mode-command.js';
import {
  parseThreadCommand,
  THREAD_COMMAND_USAGE
} from '../commands/thread-command.js';
import {
  parseWorkspaceCommand,
  WORKSPACE_COMMAND_USAGE
} from '../commands/workspace-command.js';
import type { CardRenderInput } from '../feishu/feishu-card-renderer.js';
import type { WorkspaceRegistry } from '../workspaces/workspace-registry.js';
import { createNoWorkspaceCard, createThreadDetailsCard } from './card-content.js';
import type { TurnEventProcessor } from './turn-event-processor.js';
import type { WorkspaceSessionService } from './workspace-session-service.js';

type SendCard = (card: CardRenderInput) => Promise<void>;

export const handleWorkspaceCommandResponse = async (input: {
  argument: string | undefined;
  bindCurrentWorkspaceThread: () => void;
  send: SendCard;
  turns: TurnEventProcessor;
  workspaceRegistry: WorkspaceRegistry;
  workspaceSessions: WorkspaceSessionService;
}): Promise<void> => {
  const parsed = parseWorkspaceCommand(input.argument);

  if (parsed.type === 'show') {
    const card = await input.workspaceSessions.getWorkspacesCard();

    await input.send({
      title: card.title,
      content: [card.content, WORKSPACE_COMMAND_USAGE].join('\n')
    });
    return;
  }

  if (parsed.type === 'use') {
    const selected = await input.workspaceSessions.selectWorkspaceByIndex(parsed.index);

    if (!selected) {
      await input.send({
        title: 'Workspace Selection',
        content: `No workspace found at index ${parsed.index}.`,
        template: 'red'
      });
      return;
    }

    input.bindCurrentWorkspaceThread();
    await input.send(await input.workspaceSessions.getWorkspacesCard());
    return;
  }

  const created = await input.workspaceRegistry.addWorkspace(parsed.folder);

  input.turns.bindThread({
    threadId: created.threadId,
    workspaceCwd: created.cwd
  });
  await input.send({
    title: 'Workspace Added',
    content: [
      `Current: \`${created.displayName}\``,
      `Directory: \`${created.cwd}\``
    ].join('\n'),
    template: 'green'
  });
};

export const handleThreadCommandResponse = async (input: {
  argument: string | undefined;
  bindCurrentWorkspaceThread: () => void;
  send: SendCard;
  workspaceSessions: WorkspaceSessionService;
}): Promise<void> => {
  if (!input.workspaceSessions.getCurrentWorkspaceCwd()) {
    await input.send(createNoWorkspaceCard('Thread Selection'));
    return;
  }

  let parsed;

  try {
    parsed = parseThreadCommand(input.argument);
  } catch {
    await input.send({
      title: 'Thread Selection',
      content: THREAD_COMMAND_USAGE,
      template: 'red'
    });
    return;
  }

  if (parsed.type === 'read') {
    const detail = await input.workspaceSessions.readThreadByIndex(parsed.index);

    if (!detail) {
      await input.send({
        title: 'Thread Details',
        content: `No thread found at index ${parsed.index}.`,
        template: 'red'
      });
      return;
    }

    await input.send(
      createThreadDetailsCard(detail.response, parsed.index, detail.isActive)
    );
    return;
  }

  const selected = await input.workspaceSessions.selectThreadByIndex(parsed.index);

  if (!selected) {
    await input.send({
      title: 'Thread Selection',
      content: `No thread found at index ${parsed.index}.`,
      template: 'red'
    });
    return;
  }

  input.bindCurrentWorkspaceThread();
  await input.send({
    title: 'Thread Selected',
    content: `Switched to thread ${parsed.index}.`,
    template: 'green'
  });
};

export const handleModeCommandResponse = async (input: {
  argument: string | undefined;
  send: SendCard;
  workspaceSessions: WorkspaceSessionService;
}): Promise<void> => {
  let parsed;

  try {
    parsed = parseModeCommand(input.argument);
  } catch {
    await input.send({
      title: 'Mode',
      content: MODE_COMMAND_USAGE,
      template: 'red'
    });
    return;
  }

  if (parsed.type === 'show') {
    if (!input.workspaceSessions.getCurrentWorkspaceCwd()) {
      await input.send(createNoWorkspaceCard('Mode'));
      return;
    }

    await input.send({
      title: 'Mode',
      content: `Current workspace mode: \`${input.workspaceSessions.getCurrentWorkspaceMode()}\``
    });
    return;
  }

  try {
    await input.workspaceSessions.setCurrentWorkspaceMode(parsed.mode);
  } catch (error) {
    await input.send({
      title: 'Mode',
      content: error instanceof Error ? error.message : 'Unable to update the current workspace mode.',
      template: 'red'
    });
    return;
  }

  await input.send({
    title: 'Mode Updated',
    content: [
      `Current workspace mode: \`${parsed.mode}\``,
      parsed.mode === 'plan'
        ? 'New turns will start in planning mode.'
        : 'New turns will start in default mode.'
    ].join('\n'),
    template: 'green'
  });
};
