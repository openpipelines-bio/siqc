#!/usr/bin/env node

/**
 * Generate all test datasets for the QC report generator
 * This script creates all the sample datasets used for testing
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

const datasets = [
  { type: 'sc', output: 'resources_test/sc_dataset' },
  { type: 'sc_large', output: 'resources_test/sc_dataset_large' },
  { type: 'xenium', output: 'resources_test/xenium_dataset' },
  { type: 'xenium_large', output: 'resources_test/xenium_dataset_large' }
];

console.log('Generating all test datasets...\n');

for (const dataset of datasets) {
  try {
    console.log(`Generating ${dataset.type} dataset...`);
    const outputPath = path.join(rootDir, dataset.output);
    
    execSync(`node scripts/generate_data.js ${dataset.type} ${dataset.output}`, {
      cwd: rootDir,
      stdio: 'inherit'
    });
    
    console.log(`✓ ${dataset.type} dataset complete\n`);
  } catch (error) {
    console.error(`✗ Failed to generate ${dataset.type} dataset:`, error.message);
    process.exit(1);
  }
}

console.log('All test datasets generated successfully!');
