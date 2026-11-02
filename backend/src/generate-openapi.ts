import fs from 'fs';
import path from 'path';
import { generateOpenApiJson } from './contracts';

const spec = generateOpenApiJson();
const outPath = path.resolve(__dirname, '../openapi.json');
fs.writeFileSync(outPath, JSON.stringify(spec, null, 2), 'utf-8');
console.log(`Generated openapi.json at: ${outPath}`);
