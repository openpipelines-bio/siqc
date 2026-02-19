#!/usr/bin/env node

/**
 * SIQC Report Generator CLI - Yargs Implementation
 * 
 * A modern command-line tool for generating interactive QC reports from scientific data.
 * Features progressive loading, spatial visualization, and standalone HTML output.
 * Built with Yargs for rich validation and user experience.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compressToBinary } from './scripts/compress_data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cli = yargs(hideBin(process.argv))
  .scriptName('siqc')
  .usage('🧬 Generate standalone interactive QC reports from scientific data\n\nUsage: $0 <command> [options]')
  .version('0.1.0')
  .help('help')
  .alias('h', 'help')
  .alias('v', 'version')
  .demandCommand(1, 'You need at least one command before moving on')
  .strict()
  .wrap(120);

// Generate Test Data Command
cli.command({
  command: 'generate-test-data',
  aliases: ['generate', 'gen'],
  desc: 'Generate example datasets for testing',
  builder: (yargs) => {
    return yargs
      .option('type', {
        alias: 't',
        describe: 'Dataset type to generate',
        type: 'string',
        choices: ['sc', 'sc_large', 'xenium', 'xenium_large', 'cosmx', 'cosmx_large', 'visium', 'visium_large', 'integration'],
        demandOption: true
      })
      .option('output', {
        alias: 'o',
        describe: 'Output directory for generated files',
        type: 'string',
        demandOption: true,
        normalize: true
      })
      .option('verbose', {
        describe: 'Enable verbose logging',
        type: 'boolean',
        default: false
      })
      .example([
        ['$0 generate-test-data --type sc --output ./example-data', 'Generate small single-cell dataset'],
        ['$0 gen -t xenium_large -o ./spatial --verbose', 'Generate large spatial dataset with verbose output']
      ])
      .group(['type', 'output'], 'Required Options:')
      .group(['verbose'], 'Optional Settings:');
  },
  handler: async (argv) => {
    try {
      await generateTestData(argv);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
});

// Render Report Command  
cli.command({
  command: 'render',
  aliases: ['build'],
  desc: 'Render QC report from existing data',
  builder: (yargs) => {
    return yargs
      .option('data', {
        alias: 'd',
        describe: 'Path to data JSON file',
        type: 'string',
        demandOption: true,
        normalize: true,
        coerce: (arg) => {
          const resolved = path.resolve(arg);
          if (!fs.existsSync(resolved)) {
            throw new Error(`Data file not found: ${resolved}`);
          }
          return resolved;
        }
      })
      .option('structure', {
        alias: 's', 
        describe: 'Path to structure JSON file',
        type: 'string',
        demandOption: true,
        normalize: true,
        coerce: (arg) => {
          const resolved = path.resolve(arg);
          if (!fs.existsSync(resolved)) {
            throw new Error(`Structure file not found: ${resolved}`);
          }
          return resolved;
        }
      })
      .option('output', {
        alias: 'o',
        describe: 'Output HTML file path',
        type: 'string', 
        demandOption: true,
        normalize: true,
        coerce: (arg) => {
          const resolved = path.resolve(arg);
          const outputDir = path.dirname(resolved);
          if (!fs.existsSync(outputDir)) {
            throw new Error(`Output directory does not exist: ${outputDir}`);
          }
          return resolved;
        }
      })
      .option('payload', {
        alias: 'p',
        describe: 'Path to binary payload file (auto-generated if not specified)',
        type: 'string',
        normalize: true
      })
      .option('auto-generate', {
        describe: 'Auto-generate payload file if not specified',
        type: 'boolean',
        default: true
      })
      .option('verbose', {
        describe: 'Enable verbose logging',
        type: 'boolean',
        default: false
      })
      .example([
        ['$0 render --data data.json --structure structure.json --output report.html', 'Basic report generation'],
        ['$0 render -d ./data/data.json -s ./data/structure.json -o ./reports/qc.html --verbose', 'Generate report with verbose output'],
        ['$0 build --data data.json --structure structure.json --output report.html --payload custom.bin', 'Use custom payload file']
      ])
      .group(['data', 'structure', 'output'], 'Required Options:')
      .group(['payload', 'auto-generate', 'verbose'], 'Optional Settings:');
  },
  handler: async (argv) => {
    try {
      await renderReport(argv);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
});

// Compress Data Command
cli.command({
  command: 'compress',
  desc: 'Compress data to binary payload format',
  builder: (yargs) => {
    return yargs
      .option('data', {
        alias: 'd',
        describe: 'Path to input data JSON file',
        type: 'string',
        demandOption: true,
        normalize: true,
        coerce: (arg) => {
          const resolved = path.resolve(arg);
          if (!fs.existsSync(resolved)) {
            throw new Error(`Data file not found: ${resolved}`);
          }
          return resolved;
        }
      })
      .option('structure', {
        alias: 's',
        describe: 'Path to structure JSON file',
        type: 'string',
        demandOption: true,
        normalize: true,
        coerce: (arg) => {
          const resolved = path.resolve(arg);
          if (!fs.existsSync(resolved)) {
            throw new Error(`Structure file not found: ${resolved}`);
          }
          return resolved;
        }
      })
      .option('output', {
        alias: 'o',
        describe: 'Output binary payload file path',
        type: 'string',
        demandOption: true,
        normalize: true
      })
      .option('verbose', {
        describe: 'Enable verbose logging',
        type: 'boolean',
        default: false
      })
      .example([
        ['$0 compress --data data.json --structure structure.json --output payload.bin', 'Compress to binary payload'],
        ['$0 compress -d data.json -s structure.json -o report-payload.bin --verbose', 'Compress with verbose output']
      ])
      .group(['data', 'structure', 'output'], 'Required Options:')
      .group(['verbose'], 'Optional Settings:');
  },
  handler: async (argv) => {
    try {
      await compressData(argv);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
});

// Add global middleware for validation
cli.middleware((argv) => {
  if (argv.verbose) {
    console.log('🔧 Running in verbose mode');
  }
});

// Implementation functions
async function generateTestData(options) {
  const { type, output: outputDir, verbose } = options;
  
  if (verbose) {
    console.log(`🧬 Generating ${type} test dataset...`);
  } else {
    console.log(`🧬 Generating ${type} test dataset...`);
  }
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    if (verbose) console.log(`📁 Creating directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Import and use the data generator
    const { generateScDataset, generateXeniumDataset, generateCosmxDataset, generateVisiumDataset, generateIntegrationDataset, generateScStructure, generateXeniumStructure, generateCosmxStructure, generateVisiumStructure, generateIntegrationStructure } = 
      await import('./scripts/generate_data.js');

    const generators = {
      sc: {
        label: 'Single-cell dataset',
        dataFun: generateScDataset,
        structureFun: generateScStructure
      },
      sc_large: {
        label: 'Large-scale single-cell dataset',
        dataFun: () => generateScDataset({
          numSamples: 10,
          cellsPerSample: 120000,
          totalCountsRange: [500, 15000],
          nonzeroVarsRange: [1000, 8000],
          cellbenderBackgroundMean: 0.15,
          cellbenderBackgroundSd: 0.1,
          cellSizeBase: 25,
          cellSizeSd: 15,
          dropletEfficiencyBase: 0.95,
          dropletEfficiencyRange: 0.03,
          mitoFractionMean: 0.05,
          mitoFractionSd: 0.03,
          riboFractionMean: 0.15,
          riboFractionSd: 0.05
        }),
        structureFun: generateScStructure
      },
      xenium: {
        label: 'Xenium dataset',
        dataFun: generateXeniumDataset,
        structureFun: generateXeniumStructure
      },
      xenium_large: {
        label: 'Large-scale Xenium dataset',
        dataFun: () => generateXeniumDataset({
          numSamples: 8,
          cellsPerSample: 150000,
          totalCountsRange: [50, 800],
          nonzeroVarsRange: [20, 150],
          cellAreaRange: [25, 200],
          nucleusRatioRange: [0.08, 0.45],
          spatialNoise: 3,
          mitoFractionMean: 0.06,
          mitoFractionSd: 0.025,
          riboFractionMean: 0.18,
          riboFractionSd: 0.04
        }),
        structureFun: generateXeniumStructure
      },
      cosmx: {
        label: 'CosMX dataset',
        dataFun: generateCosmxDataset,
        structureFun: generateCosmxStructure
      },
      cosmx_large: {
        label: 'Large-scale CosMX dataset',
        dataFun: () => generateCosmxDataset({
          numSamples: 8,
          cellsPerSample: 100000,
          totalCountsRange: [50, 800],
          nonzeroVarsRange: [20, 150],
          mitoFractionMean: 0.06,
          mitoFractionSd: 0.025,
          riboFractionMean: 0.18,
          riboFractionSd: 0.04
        }),
        structureFun: generateCosmxStructure
      },
      visium: {
        label: 'Visium dataset',
        dataFun: generateVisiumDataset,
        structureFun: generateVisiumStructure
      },
      visium_large: {
        label: 'Large-scale Visium dataset',
        dataFun: () => generateVisiumDataset({
          numSamples: 6,
          cellsPerSample: 15000, // Typically fewer spots max out around 5k-10k depending on chip
          totalCountsRange: [500, 20000],
          nonzeroVarsRange: [200, 4000]
        }),
        structureFun: generateVisiumStructure
      },
      integration: {
        label: 'Integration QC dataset',
        dataFun: generateIntegrationDataset,
        structureFun: generateIntegrationStructure
      }
    };

    const generator = generators[type];
    const dataPath = path.join(outputDir, 'data.json');
    const structurePath = path.join(outputDir, 'structure.json');

    if (verbose) console.log(`📊 Generating data for ${generator.label}...`);
    const data = generator.dataFun();

    if (verbose) console.log(`🏗️  Generating structure for ${generator.label}...`);
    const structure = generator.structureFun();

    if (verbose) console.log('💾 Writing data and structure to JSON files...');
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    fs.writeFileSync(structurePath, JSON.stringify(structure, null, 2));

    console.log(`✅ ${generator.label} generated successfully!`);
    console.log(`   Data: ${dataPath}`);
    console.log(`   Structure: ${structurePath}`);
    console.log('');
    console.log('🚀 Next steps:');
    console.log(`   siqc render --data ${dataPath} --structure ${structurePath} --output ./report.html`);
    
  } catch (error) {
    throw new Error(`Failed to generate ${type} dataset: ${error.message}`);
  }
}

async function renderReport(options) {
  const { data, structure, output, payload, autoGenerate, verbose } = options;
  
  if (verbose) {
    console.log('🚀 Rendering QC Report...');
    console.log(`📊 Data: ${data}`);
    console.log(`📋 Structure: ${structure}`);
    console.log(`📁 Output: ${output}`);
  } else {
    console.log('🚀 Rendering QC Report...');
  }

  // Handle payload file
  let finalPayload = payload;
  let shouldCleanupPayload = false;
  
  if (!finalPayload && autoGenerate) {
    const dataDir = path.dirname(data);
    finalPayload = path.join(dataDir, 'qc-report-payload.bin');
    shouldCleanupPayload = true; // Only cleanup if we auto-generated it
    
    // Generate the payload file before building
    if (!fs.existsSync(finalPayload)) {
      if (verbose) console.log(`🗜️ Auto-generating payload: ${finalPayload}`);
      await compressToBinary(data, finalPayload, structure);
    }
  }

  if (verbose && finalPayload) {
    console.log(`📦 Payload: ${finalPayload}`);
  }

  // Validate JSON files
  try {
    JSON.parse(fs.readFileSync(data, 'utf8'));
    JSON.parse(fs.readFileSync(structure, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid JSON file: ${error.message}`);
  }

  // Set environment variables for the Vite build
  const env = {
    ...process.env,
    QC_AUTO_GENERATE: autoGenerate.toString(),
    NODE_ENV: 'production',
    QC_DATA_PATH: data,
    QC_STRUCTURE_PATH: structure
  };

  if (finalPayload) {
    env.QC_PAYLOAD_PATH = finalPayload;
  }

  try {
    // Check if we have npm/pnpm available
    let packageManager = 'npm';
    try {
      execSync('pnpm --version', { stdio: 'ignore' });
      packageManager = 'pnpm';
    } catch {
      // Fall back to npm
    }

    // Run the build from the package directory
    if (verbose) console.log('🔨 Running build...');
    execSync(`${packageManager} run build`, {
      stdio: verbose ? 'inherit' : 'pipe',
      env,
      cwd: __dirname
    });

    const builtFile = path.join(__dirname, 'dist', 'index.html');
    
    if (!fs.existsSync(builtFile)) {
      throw new Error('Build completed but output file not found');
    }

    // Copy to final output location
    if (path.resolve(output) !== builtFile) {
      if (verbose) console.log(`📁 Copying report to: ${output}`);
      const outputDir = path.dirname(output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.copyFileSync(builtFile, output);
    }

    console.log(`✅ QC Report rendered successfully: ${output}`);

    // Show file size
    const stats = fs.statSync(output);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
    console.log(`📊 Report size: ${sizeMB} MB`);

    // Clean up temporary payload only if it was auto-generated
    if (shouldCleanupPayload && finalPayload && fs.existsSync(finalPayload)) {
      const payloadDir = path.dirname(finalPayload);
      const outputFileDir = path.dirname(output);
      
      // Only clean up if payload is in a different directory than output
      if (payloadDir !== outputFileDir) {
        try {
          fs.unlinkSync(finalPayload);
          if (verbose) console.log('🧹 Cleaned up temporary payload file');
        } catch {
          // Ignore cleanup errors
        }
      }
    }

  } catch (error) {
    throw new Error(`Render failed: ${error.message}`);
  }
}

async function compressData(options) {
  const { data, structure, output, verbose } = options;
  
  if (verbose) {
    console.log(`🗜️  Compressing data from ${data}...`);
    console.log(`� Structure: ${structure}`);
    console.log(`� Output: ${output}`);
  } else {
    console.log(`🗜️  Compressing data to binary payload...`);
  }

  try {
    const result = compressToBinary(data, output, structure);
    
    console.log(`✅ Binary payload created successfully: ${result}`);
    
    if (verbose) {
      const stats = fs.statSync(result);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`📊 Payload size: ${sizeMB} MB`);
    }
    
  } catch (error) {
    throw new Error(`Compression failed: ${error.message}`);
  }
}

// Parse command line arguments
cli.parse();
