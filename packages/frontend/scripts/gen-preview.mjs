/**
 * Converts public/preview.svg → public/preview.png (1200×630).
 * Runs automatically as the `prebuild` npm lifecycle hook so the PNG is
 * always up-to-date before Vite copies public/ into dist/.
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '../public/preview.svg');
const pngPath = join(__dirname, '../public/preview.png');

const svg = readFileSync(svgPath);

await sharp(svg, { density: 150 })
  .resize(1200, 630)
  .png({ compressionLevel: 8 })
  .toFile(pngPath);

console.log('✓ Generated public/preview.png');
