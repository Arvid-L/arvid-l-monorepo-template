import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Current template identity. The script replaces these with the new project
// name in every text file — including this file, which makes a second run a
// harmless no-op.
const CURRENT_KEBAB = 'arvid-l-monorepo-template';
const CURRENT_PASCAL = 'ArvidLMonorepoTemplate';
const CURRENT_TITLE = 'Arvid L Monorepo';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.nx',
  '.angular',
  'tmp',
  'coverage',
  '.idea',
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // package-lock.json must fit

const args = process.argv.slice(2);
const resetGit = args.includes('--reset-git');
const newName = args.find((arg) => !arg.startsWith('--'));

if (!newName) {
  console.error(
    'Usage: npm run init-project -- <new-project-name> [--reset-git]',
  );
  console.error('Example: npm run init-project -- somenewproject --reset-git');
  process.exit(1);
}

if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(newName)) {
  console.error(
    `Invalid project name "${newName}" — use kebab-case (lowercase letters, digits, dashes), e.g. "somenewproject" or "my-cool-app".`,
  );
  process.exit(1);
}

const capitalize = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1);
const newKebab = newName;
const newPascal = newName.split('-').map(capitalize).join('');
const newTitle = newName.split('-').map(capitalize).join(' ');

const repoRoot = path.join(__dirname, '../..');

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...collectFiles(path.join(dir, entry.name)));
      }
    } else if (entry.isFile()) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

const changedFiles: string[] = [];

for (const file of collectFiles(repoRoot)) {
  if (fs.statSync(file).size > MAX_FILE_SIZE) {
    continue;
  }
  const buffer = fs.readFileSync(file);
  if (buffer.includes(0)) {
    continue; // binary
  }

  const content = buffer.toString('utf8');
  const replaced = content
    .replaceAll(CURRENT_KEBAB, newKebab)
    .replaceAll(CURRENT_PASCAL, newPascal)
    .replaceAll(CURRENT_TITLE, newTitle);

  if (replaced !== content) {
    fs.writeFileSync(file, replaced);
    changedFiles.push(path.relative(repoRoot, file));
  }
}

console.log(`✓ Renamed ${CURRENT_KEBAB} → ${newKebab}`);
console.log(`✓ Renamed ${CURRENT_PASCAL} → ${newPascal}`);
console.log(`✓ Renamed "${CURRENT_TITLE}" → "${newTitle}"`);
console.log(`✓ Updated ${changedFiles.length} files:`);
changedFiles.sort().forEach((file) => console.log(`    ${file}`));

if (resetGit) {
  console.log('');
  console.log('🗑  Resetting git history...');
  fs.rmSync(path.join(repoRoot, '.git'), { recursive: true, force: true });
  execSync('git init -b main && git add -A', { cwd: repoRoot });
  execSync(`git commit -q -m "chore: init ${newKebab} from monorepo template"`, {
    cwd: repoRoot,
  });
  console.log('✓ Fresh git history on branch main (1 commit)');
}

console.log('');
console.log('Next steps:');
console.log('  1. npm run quality                 # lint + test + build must be green');
console.log('  2. Rewrite README.md intro + review CLAUDE.md for your project');
console.log('     (docs/TEMPLATE-COMPLETION-GUIDE.md is template-internal — delete it)');
if (resetGit) {
  console.log('  3. git remote add origin <your-repo-url> && git push -u origin main');
}
console.log('');
console.log(
  'Full path to a live deployment: docs/NEW-PROJECT.md (dev setup → Hetzner → HTTPS)',
);
