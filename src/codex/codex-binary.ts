import { spawn } from 'node:child_process';

export type CodexBinaryInfo = {
  command: 'codex';
  version: string;
};

export const parseCodexVersion = (stdout: string): string => {
  const trimmed = stdout.trim();
  const match = /^codex-cli\s+([^\s]+)$/u.exec(trimmed);

  if (!match?.[1]) {
    throw new Error(`Unexpected codex --version output: ${trimmed}`);
  }

  return match[1];
};

const runCommand = async (command: string, args: string[]): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(
        new Error(
          `Command failed: ${command} ${args.join(' ')}\n${stderr.trim()}`.trim()
        )
      );
    });
  });

export const detectGlobalCodexBinary = async (): Promise<CodexBinaryInfo> => {
  try {
    const stdout = await runCommand('codex', ['--version']);

    return {
      command: 'codex',
      version: parseCodexVersion(stdout)
    };
  } catch (error) {
    const maybeNodeError = error as NodeJS.ErrnoException;

    if (maybeNodeError.code === 'ENOENT') {
      throw new Error(
        'Global codex CLI was not found on PATH. Install it before starting the bot.',
        { cause: error }
      );
    }

    throw error;
  }
};
