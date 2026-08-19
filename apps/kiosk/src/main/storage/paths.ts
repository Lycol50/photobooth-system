import { mkdirSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

export type AppPaths = {
  root: string;
  database: string;
  pending: string;
  completed: string;
  frames: string;
  secrets: string;
  logs: string;
  staging: string;
};

export function createAppPaths(userDataDirectory: string): AppPaths {
  const root = resolve(userDataDirectory);
  const paths: AppPaths = {
    root,
    database: resolve(root, 'booth.sqlite3'),
    pending: resolve(root, 'pending'),
    completed: resolve(root, 'completed'),
    frames: resolve(root, 'frames'),
    secrets: resolve(root, 'secrets'),
    logs: resolve(root, 'logs'),
    staging: resolve(root, 'staging'),
  };
  for (const directory of [
    paths.root,
    paths.pending,
    paths.completed,
    paths.frames,
    paths.secrets,
    paths.logs,
    paths.staging,
  ]) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  return paths;
}

export function resolveInside(root: string, relativePath: string): string {
  if (isAbsolute(relativePath) || relativePath.includes('\0')) {
    throw new Error('Expected a relative application file reference');
  }
  const absolute = resolve(root, relativePath);
  const relation = relative(resolve(root), absolute);
  if (relation === '..' || relation.startsWith(`..\\`) || relation.startsWith('../')) {
    throw new Error('Application file reference escaped its storage root');
  }
  return absolute;
}
