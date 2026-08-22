import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve('c:/Users/Administrator/Downloads/evolve/evolve projects/byblos/code/bybloshq');
const SERVER_DIR = path.join(ROOT_DIR, 'server');

// Extract routes
const routesDir = path.join(SERVER_DIR, 'src/application/routes');
const routeFiles = fs.readdirSync(routesDir);
const routesInfo = [];

routeFiles.forEach(rf => {
  const content = fs.readFileSync(path.join(routesDir, rf), 'utf8');
  const lines = content.split('\n');
  const routeMatches = [];
  lines.forEach((l, idx) => {
    const m = l.match(/router\.(get|post|put|patch|delete)\(['"](.*?)['"]/i);
    if (m) {
      routeMatches.push({ method: m[1].toUpperCase(), path: m[2], line: idx + 1 });
    }
  });
  routesInfo.push({ file: rf, count: routeMatches.length, routes: routeMatches });
});

// Extract controllers
const controllersDir = path.join(SERVER_DIR, 'src/application/controllers');
const controllerFiles = fs.readdirSync(controllersDir);

// Extract workflows
const workflowsDir = path.join(SERVER_DIR, 'src/application/workflows');
const workflowFiles = fs.readdirSync(workflowsDir);

// Extract cron
const cronDir = path.join(SERVER_DIR, 'src/application/cron');
const cronFiles = fs.readdirSync(cronDir);

// Extract events
const eventsDir = path.join(SERVER_DIR, 'src/application/events');
const eventFiles = fs.readdirSync(eventsDir);

// Extract middleware
const middlewareDir = path.join(SERVER_DIR, 'src/application/middleware');
const middlewareFiles = fs.readdirSync(middlewareDir);

// Extract tests
const testDir = path.join(SERVER_DIR, 'test');
const testFiles = fs.readdirSync(testDir);

fs.writeFileSync('scratch/server_metadata.json', JSON.stringify({
  routes: routesInfo,
  controllers: controllerFiles,
  workflows: workflowFiles,
  cron: cronFiles,
  events: eventFiles,
  middleware: middlewareFiles,
  tests: testFiles
}, null, 2));

console.log('Server metadata extracted successfully.');
