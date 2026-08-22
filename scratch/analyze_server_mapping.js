import fs from 'fs';
import path from 'path';

const rawData = JSON.parse(fs.readFileSync('scratch/server_mapping_raw.json', 'utf8'));

console.log(`=== TOTAL SERVER FILES: ${rawData.totalFiles} | TOTAL LOC: ${rawData.totalLines} ===\n`);

// Group distribution
console.log('=== DIRECTORY BREAKDOWN ===');
console.table(Object.keys(rawData.groups).map(k => ({
  Directory: k,
  'File Count': rawData.groups[k].count,
  'Total LOC': rawData.groups[k].lines,
  '% of Server LOC': ((rawData.groups[k].lines / rawData.totalLines) * 100).toFixed(1) + '%'
})));

// Detailed breakdown of server/src/
const srcSubdirs = {};
const domainsSubdirs = {};
const appSubdirs = {};
const infraSubdirs = {};
const sharedSubdirs = {};
const testFiles = [];

rawData.files.forEach(f => {
  const p = f.serverRel;
  if (p.startsWith('src/')) {
    const parts = p.split('/');
    const top = parts[1];
    if (!srcSubdirs[top]) srcSubdirs[top] = { count: 0, lines: 0 };
    srcSubdirs[top].count++;
    srcSubdirs[top].lines += f.lines;

    if (top === 'domains' && parts.length > 2) {
      const dom = parts[2];
      if (!domainsSubdirs[dom]) domainsSubdirs[dom] = { count: 0, lines: 0, files: [] };
      domainsSubdirs[dom].count++;
      domainsSubdirs[dom].lines += f.lines;
      domainsSubdirs[dom].files.push(f);
    }

    if (top === 'application' && parts.length > 2) {
      const sub = parts[2];
      if (!appSubdirs[sub]) appSubdirs[sub] = { count: 0, lines: 0, files: [] };
      appSubdirs[sub].count++;
      appSubdirs[sub].lines += f.lines;
      appSubdirs[sub].files.push(f);
    }

    if (top === 'infrastructure' && parts.length > 2) {
      const sub = parts[2];
      if (!infraSubdirs[sub]) infraSubdirs[sub] = { count: 0, lines: 0, files: [] };
      infraSubdirs[sub].count++;
      infraSubdirs[sub].lines += f.lines;
      infraSubdirs[sub].files.push(f);
    }

    if (top === 'shared' && parts.length > 2) {
      const sub = parts[2];
      if (!sharedSubdirs[sub]) sharedSubdirs[sub] = { count: 0, lines: 0, files: [] };
      sharedSubdirs[sub].count++;
      sharedSubdirs[sub].lines += f.lines;
      sharedSubdirs[sub].files.push(f);
    }
  } else if (p.startsWith('test/')) {
    testFiles.push(f);
  }
});

console.log('\n=== SERVER/SRC/ LAYER DISTRIBUTION ===');
console.table(srcSubdirs);

console.log('\n=== APPLICATION SUBDIRECTORIES ===');
console.table(appSubdirs);

console.log('\n=== DOMAINS SUBDIRECTORIES ===');
console.table(domainsSubdirs);

console.log('\n=== INFRASTRUCTURE SUBDIRECTORIES ===');
console.table(infraSubdirs);

console.log('\n=== SHARED SUBDIRECTORIES ===');
console.table(sharedSubdirs);

console.log(`\n=== TESTS IN SERVER/TEST/ (${testFiles.length} files, ${testFiles.reduce((a,b)=>a+b.lines,0)} LOC) ===`);

// Build cross-layer dependency matrix
let appToApp = 0, appToDom = 0, appToInfra = 0, appToShared = 0;
let domToDom = 0, domToApp = 0, domToInfra = 0, domToShared = 0;
let infraToInfra = 0, infraToDom = 0, infraToApp = 0, infraToShared = 0;
let sharedToShared = 0, sharedToDom = 0, sharedToApp = 0, sharedToInfra = 0;

rawData.files.forEach(f => {
  const p = f.serverRel;
  const fromLayer = p.startsWith('src/application') ? 'app' :
                    p.startsWith('src/domains') ? 'dom' :
                    p.startsWith('src/infrastructure') ? 'infra' :
                    p.startsWith('src/shared') ? 'shared' : 'other';

  f.imports.forEach(imp => {
    let toLayer = 'ext';
    if (imp.includes('/application/') || imp.startsWith('../application') || imp.startsWith('./application')) toLayer = 'app';
    else if (imp.includes('/domains/') || imp.startsWith('../domains') || imp.startsWith('./domains')) toLayer = 'dom';
    else if (imp.includes('/infrastructure/') || imp.startsWith('../infrastructure') || imp.startsWith('./infrastructure')) toLayer = 'infra';
    else if (imp.includes('/shared/') || imp.startsWith('../shared') || imp.startsWith('./shared')) toLayer = 'shared';

    if (fromLayer === 'app') {
      if (toLayer === 'app') appToApp++;
      else if (toLayer === 'dom') appToDom++;
      else if (toLayer === 'infra') appToInfra++;
      else if (toLayer === 'shared') appToShared++;
    } else if (fromLayer === 'dom') {
      if (toLayer === 'dom') domToDom++;
      else if (toLayer === 'app') domToApp++;
      else if (toLayer === 'infra') domToInfra++;
      else if (toLayer === 'shared') domToShared++;
    } else if (fromLayer === 'infra') {
      if (toLayer === 'infra') infraToInfra++;
      else if (toLayer === 'dom') infraToDom++;
      else if (toLayer === 'app') infraToApp++;
      else if (toLayer === 'shared') infraToShared++;
    } else if (fromLayer === 'shared') {
      if (toLayer === 'shared') sharedToShared++;
      else if (toLayer === 'dom') sharedToDom++;
      else if (toLayer === 'app') sharedToApp++;
      else if (toLayer === 'infra') sharedToInfra++;
    }
  });
});

console.log('\n=== CROSS-LAYER DEPENDENCY MATRIX ===');
console.table([
  { From: 'application', 'To application': appToApp, 'To domains': appToDom, 'To infrastructure': appToInfra, 'To shared': appToShared },
  { From: 'domains', 'To application': domToApp, 'To domains': domToDom, 'To infrastructure': domToInfra, 'To shared': domToShared },
  { From: 'infrastructure', 'To application': infraToApp, 'To domains': infraToDom, 'To infrastructure': infraToInfra, 'To shared': infraToShared },
  { From: 'shared', 'To application': sharedToApp, 'To domains': sharedToDom, 'To infrastructure': sharedToInfra, 'To shared': sharedToShared },
]);

// Build Domain x Domain matrix
const domainList = Object.keys(domainsSubdirs);
const domainMatrix = {};
domainList.forEach(d1 => {
  domainMatrix[d1] = {};
  domainList.forEach(d2 => {
    domainMatrix[d1][d2] = 0;
  });
});

rawData.files.forEach(f => {
  if (f.serverRel.startsWith('src/domains/')) {
    const d1 = f.serverRel.split('/')[2];
    f.imports.forEach(imp => {
      domainList.forEach(d2 => {
        if (imp.includes(`/domains/${d2}/`) || imp.includes(`../${d2}/`)) {
          if (domainMatrix[d1] && domainMatrix[d1][d2] !== undefined) {
            domainMatrix[d1][d2]++;
          }
        }
      });
    });
  }
});

console.log('\n=== DOMAIN x DOMAIN DEPENDENCY MATRIX ===');
console.table(domainMatrix);
