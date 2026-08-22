import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve('c:/Users/Administrator/Downloads/evolve/evolve projects/byblos/code/bybloshq');
const SERVER_SRC = path.join(ROOT_DIR, 'server/src');

function getTree(dir, prefix = '') {
  let output = '';
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  entries.forEach((e, index) => {
    const isLast = index === entries.length - 1;
    const pointer = isLast ? '└── ' : '├── ';
    const nextPrefix = prefix + (isLast ? '    ' : '│   ');

    if (e.isDirectory()) {
      output += `${prefix}${pointer}${e.name}/\n`;
      output += getTree(path.join(dir, e.name), nextPrefix);
    } else {
      const fp = path.join(dir, e.name);
      const loc = fs.readFileSync(fp, 'utf8').split('\n').length;
      output += `${prefix}${pointer}${e.name} (${loc} LOC)\n`;
    }
  });
  return output;
}

const fullTree = `server/src/\n` + getTree(SERVER_SRC);
fs.writeFileSync('scratch/server_full_tree.txt', fullTree);
console.log('Server tree generated. Tree length:', fullTree.split('\n').length, 'lines.');
