import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SpotMapPin } from './types';

/** Local snapshot of already public map data; no credentials or remote writes. */
export async function previewSpots(index=false):Promise<SpotMapPin[]> {
 const body=JSON.parse(await readFile(path.join(process.cwd(),'.preview-data',index?'index.json':'spots.json'),'utf8'));
 if(!body.ok||!Array.isArray(body.data))throw new Error('Invalid public preview snapshot');
 return body.data;
}
