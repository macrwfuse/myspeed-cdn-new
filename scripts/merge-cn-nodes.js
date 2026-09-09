import fs from 'node:fs';
import path from 'node:path';

const csvDir = path.resolve(import.meta.dirname, '../../speedtest.net-CN-ID');
const outputDir = path.resolve(import.meta.dirname, '../data/servers');
const outputFile = path.join(outputDir, 'ookla.json');

// Ensure output directory exists
fs.mkdirSync(outputDir, { recursive: true });

// Read existing ookla.json if it exists
let existingServers = {};
if (fs.existsSync(outputFile)) {
    try {
        existingServers = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    } catch { }
}

// Parse CSV files
function parseCSV(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8').trim();
    const lines = content.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length < headers.length) continue;

        const row = {};
        headers.forEach((h, idx) => {
            row[h.trim()] = values[idx]?.trim() || '';
        });
        rows.push(row);
    }
    return rows;
}

// Convert CN CSV row to ookla.json format
function toOoklaFormat(row) {
    const city = row.city || '';
    const supplier = row.supplier || '';
    const country = row.country || 'China';

    return {
        name: city,
        sponsor: supplier,
        country: country,
        cc: row.country_code || 'CN',
        distance: 0,
        host: row.host || ''
    };
}

// Parse all CN-related CSV files
const csvFiles = ['CN.csv', 'CN_Mobile.csv', 'CN_Telecom.csv', 'CN_Unicom.csv'];
const cnServers = {};

for (const csvFile of csvFiles) {
    const filePath = path.join(csvDir, csvFile);
    const rows = parseCSV(filePath);

    for (const row of rows) {
        const id = row.id;
        if (!id) continue;

        // Skip duplicates (same ID might appear in multiple CSV files)
        if (cnServers[id]) continue;

        // Only include China (CN) nodes, exclude Taiwan and other regions
        if (row.country_code && row.country_code !== 'CN') continue;

        cnServers[id] = toOoklaFormat(row);
    }
}

// Merge: CN nodes take priority over existing entries
const merged = { ...existingServers, ...cnServers };

fs.writeFileSync(outputFile, JSON.stringify(merged, null, 4));

console.log(`Merged CN nodes: ${Object.keys(cnServers).length} new servers`);
console.log(`Total servers: ${Object.keys(merged).length}`);
console.log(`Output: ${outputFile}`);
