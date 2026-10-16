#!/usr/bin/env node
/** After TestFlight upload, record current internal version as the changelog baseline. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const versionPath = path.join(repoRoot, 'cost-share-app/packages/shared/version.json');

const data = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
data.lastTestFlightInternalVersion = data.version;
fs.writeFileSync(versionPath, `${JSON.stringify(data, null, 2)}\n`);
console.log('Recorded lastTestFlightInternalVersion =', data.version);
