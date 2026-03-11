# Feishu Codex Bot

Feishu Codex Bot is a personal-use Feishu bot for controlling a locally running `codex app-server`.

It connects to Feishu over long connection WebSocket mode, starts and resumes Codex threads on your machine, and lets you manage workspaces and conversations from a private chat window.

## What It Does

- Uses the globally installed `codex` CLI and `codex app-server`
- Reuses your existing local Codex history from the CLI and Codex app
- Treats a workspace as a local directory (`cwd`)
- Treats a Codex thread as the conversation/session
- Lets you browse workspaces and threads by numbered lists
- Supports creating new workspaces under a configured root directory
- Hides internal thread/turn/item IDs from the Feishu chat UI
- Can be compiled into a single binary with Bun

## Current Scope

This bot is intentionally opinionated:

- Private chat only (`p2p` text messages)
- No group chat support
- No card action callbacks
- No model switching from chat
- No streaming partial assistant text into chat
- Process errors are printed to the local console so you can paste them back into Codex for debugging

## Requirements

- macOS or Linux with a working shell environment
- A globally installed `codex` CLI available on `PATH`
- A valid local Codex login
- A Feishu custom app with bot capability enabled
- Bun installed if you want a single-file binary build

## Feishu Setup

Create a Feishu custom app and enable:

- Bot capability
- Event subscription
- Long connection mode
- `im.message.receive_v1`

After publishing the app, add the bot to your own Feishu account and open a private chat with it.

For the bot custom menu, the simplest setup is to use "Send text message" entries instead of callback events.

Suggested menu items:

- `Help` -> `/help`
- `Workspaces` -> `/workspaces`
- `Mode` -> `/mode`
- `New Conversation` -> `/new`
- `Status` -> `/status`
- `Threads` -> `/threads`

## Codex Setup

This project does not bundle Codex.

It always uses the globally installed `codex` binary from `PATH`, then starts `codex app-server` over stdio JSON-RPC.

Make sure this works before starting the bot:

```bash
codex --version
codex app-server --help
```

If your local Codex account is not authenticated, the bot will fail fast on startup.

## Configuration

The bot uses a single JSON config file.

Default path:

```bash
./bot.config.json
```

Custom path:

```bash
./feishu-codex-bot -c /absolute/path/to/bot.config.json
```

Create your local config by copying the example file:

```bash
cp ./bot.config.example.json ./bot.config.json
```

Example:

```json
{
  "serviceName": "feishu_codex_bot",
  "feishu": {
    "appId": "cli_xxx",
    "appSecret": "xxx"
  },
  "workspaceRoot": "/Users/you/Documents/workspaces",
  "cardVerbosity": "normal"
}
```

### Config Fields

- `serviceName`
  Used as the Codex app-server client/service identifier.

- `feishu.appId`
  Feishu app ID.

- `feishu.appSecret`
  Feishu app secret.

- `workspaceRoot`
  Optional root directory used by `/workspace add {folder}`. If omitted, workspace creation from chat is disabled.

- `cardVerbosity`
  Controls whether the bot sends extra progress cards during execution.
  - `minimal`: only command replies and final turn results
  - `normal`: includes coarse progress cards such as turn start, command start/finish, tool start/finish, and auto-approval notices

Notes:

- Environment-variable based runtime configuration is not used.
- Unknown config fields are rejected.

## Install

This is a Bun project.

Install dependencies with:

```bash
bun install
```

Then generate the Codex app-server TypeScript protocol files for your local Codex version:

```bash
bun run protocol:generate
```

## Run in Development

```bash
bun run dev
```

This uses:

```bash
tsx watch src/index.ts -- -c ./bot.config.json
```

## Build a Single Binary

```bash
bun run build:bin
```

Output:

```bash
./dist-bun/feishu-codex-bot
```

Run it directly:

```bash
./dist-bun/feishu-codex-bot -c ./bot.config.json
```

## Package Management

- Use `bun install` to add or update dependencies
- Commit `bun.lock`
- Do not use `npm install`
- `package-lock.json` is not part of this project anymore

## Commands

### Workspace Commands

- `/workspaces`
  Show all discovered workspaces as a numbered list.

- `/workspace`
  Show workspace help and current selection.

- `/workspace use {n}`
  Switch to the numbered workspace from `/workspaces`.

- `/workspace add {folder}`
  Create a workspace under `workspaceRoot`, switch to it, and prepare a Codex conversation there. This command is available only when `workspaceRoot` is configured.

### Conversation Commands

- `/new`
  Start a fresh conversation in the current workspace.

- `/threads`
  Show recent threads for the current workspace.

- `/thread {n}`
  Switch to the numbered thread from `/threads`.

- `/thread read {n}`
  Show details for the numbered thread from `/threads`.

### Mode and Status

- `/mode`
  Show the current collaboration mode.

- `/mode {default|plan}`
  Set the stored mode for the current workspace. It applies to the next newly started turn. If a request is already running, interrupt it first if you want the new mode to take effect immediately.

- `/status`
  Show the current workspace, mode, request status, token usage, recent plan, recent tools, and recent activity.

- `/interrupt`
  Interrupt the active request.

- `/help`
  Show command help.

### Regular Messages

Any non-command text is treated as a Codex prompt.

Behavior:

- If no request is currently running, the bot starts a new turn.
- If a request is already running, the bot sends your text as steering input to the active turn.

## Workspace Model

The bot does not maintain a separate project registry in config.

Instead, it builds the workspace list from:

- the currently active workspace from local runtime state
- discovered `cwd` values from local Codex thread history

Display names are derived automatically from folder names. If two workspaces share the same folder name, the bot expands them into the shortest unique suffix, for example:

- `repo (apps/repo)`
- `repo (experiments/repo)`

## Session Model

In Codex app-server terms:

- a `thread` is the conversation/session
- a `turn` is a single request inside that conversation

This bot follows that model directly:

- switching workspaces restores or creates a thread for that `cwd`
- selecting `/thread {n}` resumes a historical thread
- `/new` creates a new thread

Because the bot uses the same local Codex storage, conversations created from:

- Codex CLI
- Codex app
- this Feishu bot

can appear in the same history universe.

## Chat UX

The chat UI is intentionally simplified:

- no raw thread IDs
- no raw turn IDs
- no raw internal item IDs

Users see:

- numbered workspace lists
- numbered thread lists
- human-readable workspace names
- human-readable status cards

## Error Handling

Operational errors are surfaced in two places:

- a red error card in Feishu
- the local process stderr/stdout logs

The bot keeps console error logging on purpose so you can copy the error output into Codex for troubleshooting.

## Security Notes

This bot is configured for personal local use and currently runs Codex with:

- `approvalPolicy: never`
- `danger-full-access`

That is convenient, but it is also powerful. Treat this bot as local-machine control software, not as a safe multi-user bot.

## Development Commands

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run build:bin
```

## Regenerating Codex Protocol Types

This project uses TypeScript protocol files generated from your local Codex version:

```bash
bun run protocol:generate
```

This runs:

```bash
codex app-server generate-ts --out src/generated/codex-protocol
```

These generated files are intentionally gitignored in this project.

Each developer is expected to generate them locally after cloning:

```bash
bun install
bun run protocol:generate
```

## Project Structure

```text
feishu-codex-bot/
├── bot.config.example.json
├── src/
│   ├── bot/
│   ├── codex/
│   ├── commands/
│   ├── config/
│   ├── feishu/
│   ├── state/
│   └── workspaces/
├── tests/
└── package.json
```

Local-only files such as `bot.config.json`, `.data/`, `dist/`, `dist-bun/`, and generated protocol files are intentionally not committed.

## Status

This project is meant for a single personal operator using Feishu as a lightweight remote control surface for local Codex conversations.
