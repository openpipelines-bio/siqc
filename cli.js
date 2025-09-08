#!/usr/bin/env node

/**
 * QC Report Generator CLI
 * 
 * A command-line tool for generating interactive QC reports from scientific data.
 * Supports progressive loading, spatial visualization, and standalone HTML output.
 * 
 * Usage:
 *   qc-report --data /path/to/data.json --structure /path/to/structure.json
 *   qc-report --data-dir /path/to/directory/  # Uses data.json and structure.json
 *   qc-report --help
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function showHelp() {
  console.log(`
🧬 QC Report Generator

Generate interactive QC reports from scientific data with progressive loading.

Usage:
  qc-report --data <file> --structure <file> --output <file> [options]

Required Arguments:
  --data <file>         Path to the data.json file
  --structure <file>    Path to the structure.json file  
  --output <file>       Output HTML file path

Optional Arguments:
  --payload <file>      Compressed payload file (default: auto-generated)
  --no-auto-generate    Don't auto-generate payload if missing
  --help               Show this help message

Examples:
  # Generate report with specific files
  qc-report --data ./experiment-data.json --structure ./experiment-structure.json --output ./my-report.html

  # Use existing compressed payload (faster for repeated builds)
  qc-report --data ./data.json --structure ./structure.json --output ./report.html --payload ./cached-payload.bin

For more information, visit: https://github.com/openpipelines-bio/qc_report_generator
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    data: null,
    structure: null,
    output: null,
    payload: null, // Will be auto-generated if needed
    autoGenerate: true,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--data':
        options.data = nextArg;
        i++;
        break;
      case '--structure':
        options.structure = nextArg;
        i++;
        break;
      case '--output':
        options.output = nextArg;
        i++;
        break;
      case '--payload':
        options.payload = nextArg;
        i++;
        break;
      case '--no-auto-generate':
        options.autoGenerate = false;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`❌ Unknown option: ${arg}`);
          console.error('Use --help to see available options');
          process.exit(1);
        }
    }
  }

  return options;
}

function validateAndResolvePaths(options) {
  // Check required arguments
  if (!options.data) {
    console.error('❌ Missing required argument: --data');
    console.error('   Use --data to specify the path to your data.json file');
    process.exit(1);
  }
  
  if (!options.structure) {
    console.error('❌ Missing required argument: --structure');
    console.error('   Use --structure to specify the path to your structure.json file');
    process.exit(1);
  }
  
  if (!options.output) {
    console.error('❌ Missing required argument: --output');
    console.error('   Use --output to specify the output HTML file path');
    process.exit(1);
  }

  // Generate default payload path if not specified
  if (!options.payload && options.autoGenerate) {
    const outputDir = path.dirname(path.resolve(options.output));
    options.payload = path.join(outputDir, 'qc-report-payload.bin');
  }

  // Resolve to absolute paths
  options.data = path.resolve(options.data);
  options.structure = path.resolve(options.structure);
  options.output = path.resolve(options.output);
  if (options.payload) {
    options.payload = path.resolve(options.payload);
  }

  // Use package installation directory as template directory
  const templateDir = __dirname;
  if (!fs.existsSync(templateDir)) {
    console.error(`❌ Template directory not found: ${templateDir}`);
    console.error('This usually means the package installation is corrupted.');
    process.exit(1);
  }
  options.templateDir = templateDir;

  // Validate required files exist
  if (options.autoGenerate) {
    if (!fs.existsSync(options.data)) {
      console.error(`❌ Data file not found: ${options.data}`);
      process.exit(1);
    }

    if (!fs.existsSync(options.structure)) {
      console.error(`❌ Structure file not found: ${options.structure}`);
      process.exit(1);
    }
  } else {
    if (!options.payload || !fs.existsSync(options.payload)) {
      console.error(`❌ Payload file not found: ${options.payload}`);
      console.error('   Use --payload to specify an existing compressed payload file');
      process.exit(1);
    }
  }

  return options;
}

function buildReport(options) {
  console.log('🚀 Building QC Report...');
  console.log(`📊 Data: ${options.data || 'using existing payload'}`);
  console.log(`📋 Structure: ${options.structure || 'using existing payload'}`);
  console.log(`📦 Payload: ${options.payload}`);
  console.log(`📁 Output: ${options.output}`);

  // Set environment variables for the Vite build
  const env = {
    ...process.env,
    QC_PAYLOAD_PATH: options.payload,
    QC_AUTO_GENERATE: options.autoGenerate.toString(),
    NODE_ENV: 'production'
  };

  if (options.data) {
    env.QC_DATA_PATH = options.data;
  }
  if (options.structure) {
    env.QC_STRUCTURE_PATH = options.structure;
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
    console.log('🔨 Running build...');
    execSync(`${packageManager} run build`, {
      stdio: 'inherit',
      env,
      cwd: options.templateDir
    });

    const builtFile = path.join(options.templateDir, 'dist', 'index.html');
    
    if (!fs.existsSync(builtFile)) {
      console.error('❌ Build completed but output file not found');
      console.error(`Expected: ${builtFile}`);
      process.exit(1);
    }

    // Copy to final output location
    if (path.resolve(options.output) !== builtFile) {
      console.log(`📁 Copying report to: ${options.output}`);
      const outputDir = path.dirname(options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.copyFileSync(builtFile, options.output);
    }

    console.log(`✅ QC Report built successfully: ${options.output}`);

    // Show file size
    const stats = fs.statSync(options.output);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
    console.log(`📊 Report size: ${sizeMB} MB`);

    // Clean up temporary payload if it was auto-generated
    if (options.autoGenerate && options.payload && fs.existsSync(options.payload)) {
      const payloadDir = path.dirname(options.payload);
      const outputDir = path.dirname(options.output);
      
      // Only clean up if payload is in a different directory than output
      if (payloadDir !== outputDir) {
        try {
          fs.unlinkSync(options.payload);
          console.log('🧹 Cleaned up temporary payload file');
        } catch {
          // Ignore cleanup errors
        }
      }
    }

  } catch (error) {
    console.error('❌ Build failed:', error.message);
    console.error('\n💡 Make sure you have all dependencies installed in the package directory');
    process.exit(1);
  }
}

function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  // Show help if no arguments provided (since all are required)
  if (process.argv.length === 2) {
    showHelp();
    process.exit(1);
  }

  const validatedOptions = validateAndResolvePaths(options);
  buildReport(validatedOptions);
}

main();
