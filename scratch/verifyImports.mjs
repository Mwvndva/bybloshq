import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const gitFilesRaw = execSync('git -c safe.directory=* ls-files', { encoding: 'utf-8' });
const trackedFilesSet = new Set(gitFilesRaw.split(/\r?\n/).map(f => f.replace(/\\/g, '/')));

function getAllFiles(dir, exts) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, exts));
    } else {
      if (exts.some(ext => filePath.endsWith(ext))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

const sourceFiles = getAllFiles('src', ['.js', '.jsx', '.ts', '.tsx', '.mjs']);
let errors = [];

for (const file of sourceFiles) {
  const normalizedFile = file.replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf-8').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (!match) continue;
    const importPath = match[1] || match[2] || match[3];
    if (!importPath || (!importPath.startsWith('.') && !importPath.startsWith('@/'))) continue;

    let targetPath;
    if (importPath.startsWith('@/')) {
      targetPath = 'src/' + importPath.slice(2);
    } else {
      const dir = path.dirname(normalizedFile);
      targetPath = path.posix.normalize(path.posix.join(dir, importPath));
    }

    const possibleExts = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
    let found = false;

    for (const ext of possibleExts) {
      if (trackedFilesSet.has(targetPath + ext)) {
        found = true;
        break;
      }
    }

    if (!found) {
      errors.push({ file: normalizedFile, line: i + 1, importPath });
    }
  }
}

if (errors.length > 0) {
  console.log('UNRESOLVED IMPORTS FOUND:', errors);
  process.exit(1);
} else {
  console.log('SUCCESS: All internal imports in src/ resolve to Git-tracked files!');
}
