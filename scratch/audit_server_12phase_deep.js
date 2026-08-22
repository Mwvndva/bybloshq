import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve('c:/Users/Administrator/Downloads/evolve/evolve projects/byblos/code/bybloshq');
const SERVER_DIR = path.join(ROOT_DIR, 'server');
const SERVER_SRC = path.join(SERVER_DIR, 'src');

// 1. Collect all files and build dependency graph
const files = [];
function collectFiles(dir) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) {
      if (!fp.includes('node_modules') && !fp.includes('.git')) collectFiles(fp);
    } else if (f.endsWith('.js') || f.endsWith('.mjs') || f.endsWith('.ts') || f.endsWith('.json')) {
      const rel = path.relative(SERVER_DIR, fp).replace(/\\/g, '/');
      const content = fs.readFileSync(fp, 'utf8');
      const lines = content.split('\n');

      let commentLines = 0;
      let blankLines = 0;
      let nonCommentLines = 0;
      let inComment = false;

      lines.forEach(l => {
        const trimmed = l.trim();
        if (!trimmed) blankLines++;
        else if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) commentLines++;
        else if (trimmed.startsWith('/*')) { inComment = true; commentLines++; }
        else if (inComment) {
          commentLines++;
          if (trimmed.endsWith('*/') || trimmed.includes('*/')) inComment = false;
        } else if (trimmed.startsWith('//')) commentLines++;
        else nonCommentLines++;
      });

      // Parse imports
      const imports = [];
      const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"](.*?)['"]|require\(['"](.*?)['"]\))/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const target = match[1] || match[2];
        imports.push(target);
      }

      // Detect exports
      const exports = [];
      const exportRegex = /(?:export\s+(?:default\s+)?(?:class|function|const|let|var|async function)\s+([a-zA-Z0-9_$]+)|module\.exports\s*=\s*|exports\.([a-zA-Z0-9_$]+)\s*=)/g;
      while ((match = exportRegex.exec(content)) !== null) {
        exports.push(match[1] || match[2] || 'default');
      }

      // Check specific code patterns
      const hasDirectSql = content.includes('SELECT ') || content.includes('INSERT INTO') || content.includes('UPDATE ') || content.includes('DELETE FROM');
      const usesPoolDirectly = content.includes('pool.query(') || content.includes('db.query(');
      const hasTransaction = content.includes('BEGIN') || content.includes('COMMIT') || content.includes('withTransaction');

      files.push({
        path: `server/${rel}`,
        serverRel: rel,
        name: f,
        lines: lines.length,
        nonCommentLines,
        commentLines,
        blankLines,
        size: fs.statSync(fp).size,
        imports,
        exports,
        hasDirectSql,
        usesPoolDirectly,
        hasTransaction,
        content
      });
    }
  }
}

collectFiles(SERVER_DIR);

// 2. Upward Domain -> Application Imports detection
const domainToAppImports = [];
files.forEach(f => {
  if (f.serverRel.startsWith('src/domains/')) {
    f.imports.forEach(imp => {
      if (imp.includes('application/') || imp.includes('../application') || imp.includes('../../application')) {
        domainToAppImports.push({ file: f.serverRel, import: imp });
      }
    });
  }
});

// 3. Controllers direct SQL / DB check
const controllersSql = [];
files.forEach(f => {
  if (f.serverRel.startsWith('src/application/controllers/')) {
    if (f.hasDirectSql || f.usesPoolDirectly) {
      controllersSql.push({ file: f.serverRel, directSql: f.hasDirectSql, pool: f.usesPoolDirectly });
    }
  }
});

// 4. Repositories in shared/utils check
const sharedRepositories = [];
files.forEach(f => {
  if (f.serverRel.startsWith('src/shared/utils/') && f.name.includes('repository')) {
    sharedRepositories.push({ file: f.serverRel, name: f.name, lines: f.lines });
  }
});

// 5. Circular Dependency detection via Graph DFS
const fileMap = new Map();
files.forEach(f => fileMap.set(f.serverRel, f));

const cycles = [];
function findCycles() {
  const visited = new Set();
  const recStack = new Set();

  function dfs(curr, currPath = []) {
    visited.add(curr);
    recStack.add(curr);
    currPath.push(curr);

    const f = fileMap.get(curr);
    if (f) {
      f.imports.forEach(imp => {
        // Resolve relative import
        if (imp.startsWith('.')) {
          const dir = path.dirname(curr);
          let resolved = path.normalize(dir + '/' + imp).replace(/\\/g, '/');
          if (!resolved.endsWith('.js') && !resolved.endsWith('.json')) {
            if (fileMap.has(resolved + '.js')) resolved = resolved + '.js';
          }
          if (recStack.has(resolved)) {
            cycles.push([...currPath, resolved]);
          } else if (!visited.has(resolved) && fileMap.has(resolved)) {
            dfs(resolved, [...currPath]);
          }
        }
      });
    }

    recStack.delete(curr);
  }

  for (const f of files) {
    if (!visited.has(f.serverRel) && f.serverRel.startsWith('src/')) {
      dfs(f.serverRel);
    }
  }
}
findCycles();

// 6. Test File Mapping to Domain / Routes
const testsInServer = files.filter(f => f.serverRel.startsWith('test/'));
const testMappings = testsInServer.map(t => {
  const targets = [];
  files.forEach(sf => {
    if (sf.serverRel.startsWith('src/')) {
      const base = sf.name.replace(/\.(js|ts)$/, '');
      if (t.content.includes(base) || t.content.includes(sf.serverRel.replace('src/', ''))) {
        targets.push(sf.serverRel);
      }
    }
  });
  return {
    testFile: t.serverRel,
    loc: t.lines,
    targets: Array.from(new Set(targets))
  };
});

fs.writeFileSync('scratch/server_audit_deep_results.json', JSON.stringify({
  totalFiles: files.length,
  domainToAppImports,
  controllersSql,
  sharedRepositories,
  cyclesCount: cycles.length,
  cycles,
  testMappings
}, null, 2));

console.log('Deep audit analysis complete.');
console.log('Domain -> App Imports count:', domainToAppImports.length);
console.log('Controllers with Direct SQL count:', controllersSql.length);
console.log('Shared Repositories count:', sharedRepositories.length);
console.log('Cycles count:', cycles.length);
console.log('Test files count:', testMappings.length);
