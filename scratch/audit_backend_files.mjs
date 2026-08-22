import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverSrcDir = path.resolve(__dirname, '../server/src');

function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getAllFiles(filePath, fileList);
        } else if (file.endsWith('.js')) {
            fileList.push(filePath);
        }
    });
    return fileList;
}

const jsFiles = getAllFiles(serverSrcDir);
console.log(`Auditing ${jsFiles.length} JS files in server/src...`);

const results = [];

jsFiles.forEach(filePath => {
    const relativePath = path.relative(serverSrcDir, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Check duplicate imports
    const importLines = lines
        .map((line, idx) => ({ line: line.trim(), num: idx + 1 }))
        .filter(item => item.line.startsWith('import ') || item.line.startsWith('export '));

    const importsMap = new Map();
    const duplicates = [];

    importLines.forEach(item => {
        if (importsMap.has(item.line)) {
            duplicates.push({ line: item.line, first: importsMap.get(item.line), second: item.num });
        } else {
            importsMap.set(item.line, item.num);
        }
    });

    // Check for require in ESM
    const requireLines = lines
        .map((line, idx) => ({ line: line.trim(), num: idx + 1 }))
        .filter(item => item.line.includes('require(') && !item.line.startsWith('//') && !item.line.includes('createRequire'));

    if (duplicates.length > 0 || requireLines.length > 0) {
        results.push({
            file: relativePath,
            duplicates,
            requireLines
        });
    }
});

console.log('--- Audit Results ---');
console.log(JSON.stringify(results, null, 2));
