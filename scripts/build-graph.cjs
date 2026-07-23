const fs = require('fs');
const path = require('path');

const root = process.cwd();

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'android', 'e2e', '.agents', '.idea', '.claude']);
const EXTS = ['.ts', '.tsx', '.js', '.jsx'];

function walk(dir, depth) {
  depth = depth || 0;
  if (depth > 12) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push.apply(files, walk(full, depth + 1));
    else if (EXTS.some(function(x) { return e.name.endsWith(x); })) files.push(full);
  }
  return files;
}

const files = walk(root);
const allRels = new Set(files.map(function(f) { return path.relative(root, f).replace(/\\/g, '/'); }));

function resolveImport(fromFile, importPath) {
  if (!importPath.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), importPath);
  const candidates = [base, base + '.ts', base + '.tsx', base + '.js', base + '.jsx',
    path.join(base, 'index.ts'), path.join(base, 'index.tsx'), path.join(base, 'index.js')];
  for (let i = 0; i < candidates.length; i++) {
    const rel = path.relative(root, candidates[i]).replace(/\\/g, '/');
    if (allRels.has(rel)) return rel;
  }
  return path.relative(root, base).replace(/\\/g, '/');
}

const graph = {};

for (let i = 0; i < files.length; i++) {
  const f = files[i];
  const rel = path.relative(root, f).replace(/\\/g, '/');
  const content = fs.readFileSync(f, 'utf8');
  const imports = {};
  const re = /from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const imp = m[1];
    if (imp.startsWith('.')) {
      const resolved = resolveImport(f, imp);
      if (resolved) imports[resolved] = true;
    } else if (imp.startsWith('@/')) {
      imports['src/' + imp.slice(2)] = true;
    }
  }
  graph[rel] = Object.keys(imports);
}

// Reverse graph
const reverseGraph = {};
const rels = Object.keys(graph);
for (let i = 0; i < rels.length; i++) {
  const file = rels[i];
  const deps = graph[file];
  for (let j = 0; j < deps.length; j++) {
    const dep = deps[j];
    if (!reverseGraph[dep]) reverseGraph[dep] = [];
    reverseGraph[dep].push(file);
  }
}

function classify(rel) {
  if (rel.includes('/features/auth/')) return 'auth';
  if (rel.includes('/features/membership/')) return 'membership';
  if (rel.includes('/features/shop/')) return 'shop';
  if (rel.includes('/features/notifications/')) return 'notifications';
  if (rel.includes('/hooks/buyer/')) return 'hooks:buyer';
  if (rel.includes('/hooks/seller/')) return 'hooks:seller';
  if (rel.includes('/hooks/creator/')) return 'hooks:creator';
  if (rel.includes('/hooks/admin/')) return 'hooks:admin';
  if (rel.includes('/hooks/auth/')) return 'hooks:auth';
  if (rel.includes('/hooks/public/')) return 'hooks:public';
  if (rel.includes('/hooks/')) return 'hooks:shared';
  if (rel.includes('/pages/admin/')) return 'pages:admin';
  if (rel.includes('/pages/creator/')) return 'pages:creator';
  if (rel.includes('/pages/logistics/')) return 'pages:logistics';
  if (rel.includes('/pages/marketing/')) return 'pages:marketing';
  if (rel.includes('/pages/')) return 'pages:shared';
  if (rel.includes('/components/ui/')) return 'ui:primitives';
  if (rel.includes('/components/buyer/')) return 'ui:buyer';
  if (rel.includes('/components/seller/')) return 'ui:seller';
  if (rel.includes('/components/')) return 'ui:shared';
  if (rel.includes('/api/')) return 'api-client';
  if (rel.includes('/routes/')) return 'routes';
  if (rel.includes('/stores/')) return 'stores';
  if (rel.includes('/lib/')) return 'lib';
  if (rel.includes('/types/')) return 'types';
  if (rel.includes('/utils/')) return 'utils';
  if (rel.startsWith('server/')) return 'server';
  if (rel.startsWith('scripts/')) return 'scripts';
  return 'other';
}

const nodes = files.map(function(f) {
  const rel = path.relative(root, f).replace(/\\/g, '/');
  const stat = fs.statSync(f);
  return {
    id: rel,
    label: path.basename(rel),
    role: classify(rel),
    sizeBytes: stat.size,
    imports: graph[rel] || [],
    importedBy: reverseGraph[rel] || [],
  };
});

const hubs = nodes.slice().sort(function(a, b) {
  return b.importedBy.length - a.importedBy.length;
}).slice(0, 20).map(function(n) {
  return { id: n.id, importedBy: n.importedBy.length, imports: n.imports.length };
});

const byRole = {};
for (let i = 0; i < nodes.length; i++) {
  const n = nodes[i];
  if (!byRole[n.role]) byRole[n.role] = [];
  byRole[n.role].push(n.id);
}

const nodeMap = {};
for (let i = 0; i < nodes.length; i++) {
  nodeMap[nodes[i].id] = nodes[i];
}

const output = {
  meta: {
    generatedAt: new Date().toISOString(),
    totalFiles: nodes.length,
    rootDir: root,
  },
  hubs: hubs,
  byRole: byRole,
  nodes: nodeMap,
};

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'codebase-graph.json'), JSON.stringify(output, null, 2));
console.log('Done. Files indexed: ' + nodes.length);
console.log('Top hubs:');
hubs.slice(0, 8).forEach(function(h) {
  console.log('  ' + h.id + ' (' + h.importedBy + ' importers, ' + h.imports + ' deps)');
});
