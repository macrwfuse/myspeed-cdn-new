import fs from 'node:fs';
import path from 'node:path';

const baseDir = process.cwd();

const neededFolder = ["data", "bin", "data/logs", "data/servers", "data/certs"];

neededFolder.forEach(folder => {
    const fullPath = path.join(baseDir, folder);
    if (!fs.existsSync(fullPath)) {
        try {
            fs.mkdirSync(fullPath, {recursive: true});
        } catch (e) {
            console.error(`Could not create the ${folder} folder. Please check the permission`);
            process.exit(0);
        }
    }
});