import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve('c:/Users/Administrator/Downloads/evolve/evolve projects/byblos/code/bybloshq');
const SERVER_DIR = path.join(ROOT_DIR, 'server');

function scanServer(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      if (!fp.includes('node_modules') && !fp.includes('.git')) {
        scanServer(fp, fileList);
      }
    } else if (f.endsWith('.js') || f.endsWith('.mjs') || f.endsWith('.json') || f.endsWith('.ts') || f.endsWith('.sql')) {
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

      // Parse ES & CommonJS imports
      const imports = [];
      const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"](.*?)['"]|require\(['"](.*?)['"]\))/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1] || match[2]);
      }

      // Detect exports
      const exports = [];
      const exportRegex = /(?:export\s+(?:default\s+)?(?:class|function|const|let|var)\s+([a-zA-Z0-9_$]+)|module\.exports\s*=\s*|exports\.([a-zA-Z0-9_$]+)\s*=)/g;
      while ((match = exportRegex.exec(content)) !== null) {
        exports.push(match[1] || match[2] || 'default');
      }

      // Feature / domain indicators
      const hasDb = content.includes('pool.query') || content.includes('db.query') || content.includes('SELECT ') || content.includes('INSERT ') || content.includes('UPDATE ') || content.includes('DELETE ');
      const hasTransaction = content.includes('BEGIN') || content.includes('COMMIT') || content.includes('ROLLBACK') || content.includes('withTransaction');
      const hasPaystack = content.includes('paystack') || content.includes('Paystack');
      const hasFcm = content.includes('messaging()') || content.includes('fcm') || content.includes('firebase');
      const hasCloudinary = content.includes('cloudinary');
      const hasRedis = content.includes('redis') || content.includes('Redis');

      fileList.push({
        path: `server/${rel}`,
        serverRel: rel,
        name: f,
        lines: lines.length,
        nonCommentLines,
        commentLines,
        blankLines,
        size: stat.size,
        imports,
        exports,
        hasDb,
        hasTransaction,
        hasPaystack,
        hasFcm,
        hasCloudinary,
        hasRedis
      });
    }
  }
  return fileList;
}

const serverFiles = scanServer(SERVER_DIR);
console.log(`Discovered ${serverFiles.length} files in server/`);

// Group by top-level section
const groups = {};
serverFiles.forEach(f => {
  const parts = f.serverRel.split('/');
  const group = parts[0] === 'src' && parts.length > 1 ? `src/${parts[1]}` : parts[0];
  if (!groups[group]) groups[group] = { count: 0, lines: 0, files: [] };
  groups[group].count++;
  groups[group].lines += f.lines;
  groups[group].files.push(f);
});

fs.writeFileSync(path.resolve('c:/Users/Administrator/Downloads/evolve/evolve projects/byblos/code/bybloshq/scratch/server_mapping_raw.json'), JSON.stringify({
  totalFiles: serverFiles.length,
  totalLines: serverFiles.reduce((a, b) => a + b.lines, 0),
  groups,
  files: serverFiles
}, null, 2));

console.log('Server mapping raw data written.');
