import { basename, sep } from 'node:path';

export type WorkspaceListEntry = {
  cwd: string;
  displayName: string;
  isCurrent: boolean;
};

const collator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base'
});

const getPathSegments = (cwd: string): string[] =>
  cwd.split(sep).filter(Boolean);

const getDisplayNameMap = (cwds: string[]): Map<string, string> => {
  const baseNameGroups = new Map<string, string[]>();

  for (const cwd of cwds) {
    const baseName = basename(cwd) || cwd;
    const group = baseNameGroups.get(baseName) ?? [];

    group.push(cwd);
    baseNameGroups.set(baseName, group);
  }

  const displayNames = new Map<string, string>();

  for (const [baseName, group] of baseNameGroups) {
    if (group.length === 1) {
      displayNames.set(group[0] as string, baseName);
      continue;
    }

    const segmentsByCwd = new Map(
      group.map((cwd) => [cwd, getPathSegments(cwd)])
    );
    const maxDepth = Math.max(
      ...group.map((cwd) => (segmentsByCwd.get(cwd) ?? []).length)
    );

    for (const cwd of group) {
      const segments = segmentsByCwd.get(cwd) ?? [];

      for (let depth = 2; depth <= maxDepth; depth += 1) {
        const suffix = segments.slice(-depth).join('/');
        const duplicate = group.some((candidate) => {
          if (candidate === cwd) {
            return false;
          }

          const candidateSegments = segmentsByCwd.get(candidate) ?? [];
          return candidateSegments.slice(-depth).join('/') === suffix;
        });

        if (!duplicate) {
          displayNames.set(cwd, `${baseName} (${suffix})`);
          break;
        }
      }

      if (!displayNames.has(cwd)) {
        displayNames.set(cwd, `${baseName} (${cwd})`);
      }
    }
  }

  return displayNames;
};

export const buildWorkspaceListEntries = (input: {
  activeWorkspaceCwd: string | null;
  discovered: string[];
}): WorkspaceListEntry[] => {
  const uniqueCwds = [
    ...new Set(
      input.activeWorkspaceCwd
        ? [input.activeWorkspaceCwd, ...input.discovered]
        : input.discovered
    )
  ];
  const displayNames = getDisplayNameMap(uniqueCwds);

  return uniqueCwds
    .map((cwd) => ({
      cwd,
      displayName: displayNames.get(cwd) ?? (basename(cwd) || cwd),
      isCurrent: cwd === input.activeWorkspaceCwd
    }))
    .sort((left, right) => {
      const displayNameOrder = collator.compare(left.displayName, right.displayName);

      if (displayNameOrder !== 0) {
        return displayNameOrder;
      }

      return collator.compare(left.cwd, right.cwd);
    });
};
