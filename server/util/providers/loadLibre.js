import fs from 'node:fs';
import path from 'node:path';
import { libreVersion, libreList } from '../../config/binaries.js';
import { tmpFile, downloadToFile, extractBinary } from './downloadHelper.js';

const binaryName = `librespeed-cli${process.platform === 'win32' ? '.exe' : ''}`;
const binaryRegex = /librespeed-cli(.exe)?$/;
const binaryDirectory = path.join(process.cwd(), 'bin');
const binaryPath = path.join(binaryDirectory, binaryName);

const downloadPath = `https://github.com/librespeed/speedtest-cli/releases/download/v${libreVersion}/librespeed-cli_${libreVersion}_`;

export const fileExists = async () => fs.existsSync(binaryPath);

export const downloadFile = async () => {
    const binary = libreList.find(b => b.os === process.platform && b.arch === process.arch);
    if (!binary)
        throw new Error(`Your platform (${process.platform}-${process.arch}) is not supported by the LibreSpeed CLI`);

    const archivePath = tmpFile(binary.suffix);
    await downloadToFile(downloadPath + binary.suffix, archivePath);
    await extractBinary(archivePath, binaryDirectory, binaryRegex, binaryName);
};

export const load = async () => {
    if (!await fileExists()) await downloadFile();
};
