const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../server/.env');
const ioURL = 'https://346acec0105d.ngrok-free.app';

try {
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const lines = content.split('\n');
    const newLines = [];
    let apiFound = false;
    let backendFound = false;

    for (const line of lines) {
        if (line.startsWith('API_URL=')) {
            newLines.push(`API_URL=${ioURL}`);
            apiFound = true;
        } else if (line.startsWith('BACKEND_URL=')) {
            newLines.push(`BACKEND_URL=${ioURL}`);
            backendFound = true;
        } else {
            newLines.push(line);
        }
    }

    if (!apiFound) newLines.push(`API_URL=${ioURL}`);
    if (!backendFound) newLines.push(`BACKEND_URL=${ioURL}`);

    fs.writeFileSync(envPath, newLines.join('\n'));
    console.log('Updated .env successfully');
    console.log(`API_URL=${ioURL}`);
    console.log(`BACKEND_URL=${ioURL}`);

} catch (err) {
    console.error('Error updating .env:', err);
}
