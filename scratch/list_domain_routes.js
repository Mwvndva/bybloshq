import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve('c:/Users/Administrator/Downloads/evolve/evolve projects/byblos/code/bybloshq/server/src/domains');

function findRouteFiles(dir) {
  const list = [];
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) {
      list.push(...findRouteFiles(fp));
    } else if (f.includes('.routes.') || f.endsWith('routes.js')) {
      list.push(fp.replace(/\\/g, '/'));
    }
  }
  return list;
}

const domainRouteFiles = findRouteFiles(ROOT_DIR);
console.log('Domain route files found:', domainRouteFiles.length);
domainRouteFiles.forEach(rf => console.log(rf));

fs.writeFileSync('scratch/domain_routes.json', JSON.stringify(domainRouteFiles, null, 2));
