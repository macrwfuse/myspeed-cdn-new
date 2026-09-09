import * as libreProvider from './providers/loadLibre.js';
import * as ooklaProvider from './providers/loadOokla.js';
import * as cloudflareProvider from './providers/loadCloudflare.js';

export const load = async () => {
    // Binaries are pre-installed in the Docker image.
    // For non-Docker deployments, ensure bin/ directory contains the CLI binaries.
    const checks = [
        { name: 'LibreSpeed', provider: libreProvider },
        { name: 'Ookla', provider: ooklaProvider },
        { name: 'Cloudflare', provider: cloudflareProvider },
    ];

    for (const { name, provider } of checks) {
        if (await provider.fileExists()) {
            console.log(`${name} binary ready.`);
        } else {
            console.warn(`${name} binary not found in bin/. Speed tests using ${name} will not work.`);
        }
    }
};