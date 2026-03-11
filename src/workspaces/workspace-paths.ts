import { isAbsolute, relative, resolve } from 'node:path';

const escapesRoot = (rootDir: string, targetDir: string): boolean => {
  const pathRelative = relative(rootDir, targetDir);

  return (
    pathRelative === '' ||
    pathRelative === '..' ||
    pathRelative.startsWith('../')
  );
};

export const resolveWorkspaceDirectory = (
  rootDir: string,
  folder: string
): string => {
  const resolvedRootDir = resolve(rootDir);
  const folderName = folder.trim();

  if (isAbsolute(folderName)) {
    throw new Error(
      'Workspace folder must be a relative path inside the configured root directory.'
    );
  }

  const targetDir = resolve(resolvedRootDir, folderName);

  if (escapesRoot(resolvedRootDir, targetDir)) {
    throw new Error(
      'Workspace folder must stay inside the configured root directory.'
    );
  }

  return targetDir;
};
