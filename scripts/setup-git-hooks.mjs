import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hooksDirectory = resolve(repositoryRoot, '.githooks');

if (!existsSync(hooksDirectory)) {
  throw new Error('Directory .githooks non trovata.');
}

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: repositoryRoot,
    stdio: 'ignore',
  });
} catch {
  process.exit(0);
}

execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], {
  cwd: repositoryRoot,
  stdio: 'inherit',
});
console.log('Git hooks path configured.');
