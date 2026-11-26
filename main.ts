// Hand-in program for the Sunwing Courier flight game entry.
// It stages the static game and its screenshots into the output directory
// and writes the dossier the judge reads, using the kit's own library.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function stageEntryFiles(): void {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

function writeJudgeDossier(): void {
  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

function confirmStagedOutput(): void {
  // The scorer rebuilds the dossier from the staged files and compares it
  // byte for byte, so fail loudly here if the staging ever drifts.
  const rebuilt = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  if (rebuilt.length === 0) throw new Error('dossier came back empty');
  console.log(`staged Sunwing Courier: dossier ${rebuilt.length} bytes`);
}

stageEntryFiles();
writeJudgeDossier();
confirmStagedOutput();
