import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve('c:/Users/Administrator/Downloads/evolve/evolve projects/byblos/code/bybloshq/server/src');
const appRoutesDir = path.join(ROOT_DIR, 'application/routes');

console.log('=== FILES IN src/application/routes/ ===');
fs.readdirSync(appRoutesDir).forEach(f => {
  const fp = path.join(appRoutesDir, f);
  const content = fs.readFileSync(fp, 'utf8');
  console.log(`\n--- ${f} (${content.split('\n').length} lines) ---`);
  console.log(content.slice(0, 300));
});
