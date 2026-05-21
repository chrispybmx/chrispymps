#!/usr/bin/env npx tsx
/**
 * ChrispyMPS — Strip EXIF metadata from all images in spot-photos bucket
 *
 * Usage:
 *   npx tsx scripts/strip-existing-exif.ts
 *   DRY_RUN=1 npx tsx scripts/strip-existing-exif.ts
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'spot-photos';
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.substring(dot + 1).toLowerCase();
}

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(filename));
}

/**
 * Recursively list every file in the bucket.
 * Supabase storage.list() only returns one folder level, so we need to
 * recurse into each subfolder.
 */
async function listAllFiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  prefix: string = '',
): Promise<string[]> {
  const paths: string[] = [];

  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    offset: 0,
  });

  if (error) {
    console.error(`  ERROR listing "${prefix}":`, error.message);
    return paths;
  }

  if (!data) return paths;

  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

    if (item.id === null) {
      // It's a folder — recurse
      const nested = await listAllFiles(supabase, fullPath);
      paths.push(...nested);
    } else {
      // It's a file
      paths.push(fullPath);
    }
  }

  return paths;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (DRY_RUN) {
    console.log('=== DRY RUN — no files will be modified ===\n');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  const supabase = createClient(url, key);

  console.log(`Listing all files in bucket "${BUCKET}"...`);
  const allFiles = await listAllFiles(supabase);
  console.log(`Found ${allFiles.length} file(s).\n`);

  if (allFiles.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let stripped = 0;
  let skipped = 0;
  let errors = 0;
  const total = allFiles.length;

  for (let i = 0; i < total; i++) {
    const filePath = allFiles[i];
    const index = `[${i + 1}/${total}]`;

    if (!isImageFile(filePath)) {
      console.log(`${index} skipped: ${filePath} (not image)`);
      skipped++;
      continue;
    }

    try {
      // Download
      const { data: blob, error: dlError } = await supabase.storage
        .from(BUCKET)
        .download(filePath);

      if (dlError || !blob) {
        throw new Error(`Download failed: ${dlError?.message ?? 'no data'}`);
      }

      const buffer = Buffer.from(await blob.arrayBuffer());

      // Strip EXIF via sharp (rotate auto-applies EXIF orientation then discards metadata)
      const strippedBuffer = await sharp(buffer).rotate().toBuffer();

      if (DRY_RUN) {
        console.log(
          `${index} would strip: ${filePath} (${buffer.length} → ${strippedBuffer.length} bytes)`,
        );
        stripped++;
        continue;
      }

      // Re-upload (overwrite)
      const ext = getExtension(filePath);
      const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';

      const { error: upError } = await supabase.storage
        .from(BUCKET)
        .update(filePath, strippedBuffer, {
          contentType,
          upsert: true,
        });

      if (upError) {
        throw new Error(`Upload failed: ${upError.message}`);
      }

      console.log(
        `${index} stripped: ${filePath} (${buffer.length} → ${strippedBuffer.length} bytes)`,
      );
      stripped++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${index} ERROR: ${filePath} — ${msg}`);
      errors++;
    }
  }

  // Summary
  console.log('\n========== SUMMARY ==========');
  console.log(`Total files : ${total}`);
  console.log(`Stripped    : ${stripped}${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`Skipped     : ${skipped}`);
  console.log(`Errors      : ${errors}`);
  console.log('==============================');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
