#!/usr/bin/env node

/**
 * QC Report Generator CLI
 * 
 * A command-line tool for generating interactive QC reports from scientific data.
 * Supports progressive loading, spatial visualization, and standalone HTML output.
 * 
 * Usage:
 *   qc-report generate <type> <output-dir>
 *   qc-report build --data <file> --structure <file> --output <file>
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
  qc-report <command> [options]

Commands:
  generate-test-data             Generate example datasets for testing
  render                         Render QC report from existing data

Generate Test Data Command:
  qc-report generate-test-data --type <type> --output <dir>
    
  Required:
    --type <type>         Dataset type to generate
    --output <dir>        Output directory for generated files

  Types:
    sc           Single-cell RNA-seq dataset (small, ~20 cells)
    sc_large     Large single-cell dataset (~1.2M cells)
    xenium       Xenium spatial dataset (small, ~20 cells)
    xenium_large Large Xenium spatial dataset (~1.2M cells)

  Examples:
    qc-report generate-test-data --type sc --output ./example-data
    qc-report generate-test-data --type xenium --output ./spatial-example

Render Command:
  qc-report render --data <file> --structure <file> --output <file> [options]

  Required:
    --data <file>         Path to the data.json file
    --structure <file>    Path to the structure.json file  
    --output <file>       Output HTML file path

  Optional:
    --payload <file>      Compressed payload file (default: auto-generated)
    --no-auto-generate    Don't auto-generate payload if missing

  Examples:
    qc-report render --data ./data.json --structure ./structure.json --output ./report.html
    qc-report render --data ./my-data/data.json --structure ./my-data/structure.json --output ./my-report.html

Quick Start:
  # Generate example data and render report
  qc-report generate-test-data --type sc --output ./example
  qc-report render --data ./example/data.json --structure ./example/structure.json --output ./report.html

Global Options:
  --help               Show this help message
  --version            Show version information

For more information, visit: https://github.com/openpipelines-bio/qc_report_generator
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  
  // Handle help and version at the top level
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { command: 'help' };
  }
  
  if (args.includes('--version') || args.includes('-v')) {
    return { command: 'version' };
  }

  const command = args[0];
  
  if (command === 'generate-test-data') {
    return parseGenerateTestDataCommand(args.slice(1));
  } else if (command === 'render') {
    return parseRenderCommand(args.slice(1));
  } else {
    console.error(`❌ Unknown command: ${command}`);
    console.error('Available commands: generate-test-data, render');
    console.error('Use --help to see usage information');
    process.exit(1);
  }
}

function parseGenerateTestDataCommand(args) {
  const options = {
    command: 'generate-test-data',
    type: null,
    outputDir: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--type':
        if (!nextArg) {
          console.error('❌ --type requires a dataset type');
          process.exit(1);
        }
        options.type = nextArg;
        i++;
        break;
      case '--output':
        if (!nextArg) {
          console.error('❌ --output requires a directory path');
          process.exit(1);
        }
        options.outputDir = nextArg;
        i++;
        break;
      case '--help':
      case '-h':
        return { command: 'help' };
      default:
        console.error(`❌ Unknown option for generate-test-data command: ${arg}`);
        console.error('Use "qc-report generate-test-data --help" to see available options');
        process.exit(1);
    }
  }

  // Validate required arguments
  if (!options.type) {
    console.error('❌ Missing required argument: --type');
    console.error('Usage: qc-report generate-test-data --type <type> --output <dir>');
    process.exit(1);
  }

  if (!options.outputDir) {
    console.error('❌ Missing required argument: --output');
    console.error('Usage: qc-report generate-test-data --type <type> --output <dir>');
    process.exit(1);
  }
  
  const validTypes = ['sc', 'sc_large', 'xenium', 'xenium_large'];
  if (!validTypes.includes(options.type)) {
    console.error(`❌ Invalid dataset type: ${options.type}`);
    console.error(`Valid types: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  return options;
}

function parseRenderCommand(args) {
  const options = {
    command: 'render',
    data: null,
    structure: null,
    output: null,
    payload: null,
    autoGenerate: true
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--data':
        if (!nextArg) {
          console.error('❌ --data requires a file path');
          process.exit(1);
        }
        options.data = nextArg;
        i++;
        break;
      case '--structure':
        if (!nextArg) {
          console.error('❌ --structure requires a file path');
          process.exit(1);
        }
        options.structure = nextArg;
        i++;
        break;
      case '--output':
        if (!nextArg) {
          console.error('❌ --output requires a file path');
          process.exit(1);
        }
        options.output = nextArg;
        i++;
        break;
      case '--payload':
        if (!nextArg) {
          console.error('❌ --payload requires a file path');
          process.exit(1);
        }
        options.payload = nextArg;
        i++;
        break;
      case '--no-auto-generate':
        options.autoGenerate = false;
        break;
      case '--help':
      case '-h':
        return { command: 'help' };
      default:
        console.error(`❌ Unknown option for render command: ${arg}`);
        console.error('Use "qc-report render --help" to see available options');
        process.exit(1);
    }
  }

  return options;
}

function validateRenderOptions(options) {
  // Validate required arguments for render command
  if (!options.data || !options.structure || !options.output) {
    console.error('❌ Missing required arguments for render command');
    console.error('   Required: --data <file> --structure <file> --output <file>');
    process.exit(1);
  }

  // Resolve and validate paths
  options.data = path.resolve(options.data);
  options.structure = path.resolve(options.structure);
  options.output = path.resolve(options.output);

  if (!fs.existsSync(options.data)) {
    console.error(`❌ Data file not found: ${options.data}`);
    process.exit(1);
  }

  if (!fs.existsSync(options.structure)) {
    console.error(`❌ Structure file not found: ${options.structure}`);
    process.exit(1);
  }

  // Validate output directory exists
  const outputDir = path.dirname(options.output);
  if (!fs.existsSync(outputDir)) {
    console.error(`❌ Output directory does not exist: ${outputDir}`);
    console.error('   Please create the directory first or use an existing path');
    process.exit(1);
  }

  // Handle payload file
  if (options.payload) {
    options.payload = path.resolve(options.payload);
    if (!fs.existsSync(options.payload)) {
      console.error(`❌ Payload file not found: ${options.payload}`);
      process.exit(1);
    }
  } else if (options.autoGenerate) {
    // Auto-generate payload path
    const dataDir = path.dirname(options.data);
    options.payload = path.join(dataDir, 'qc-report-payload.bin');
  }

  return options;
}

async function generateTestData(type, outputDir) {
  console.log(`🧬 Generating ${type} test dataset...`);
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    console.log(`📁 Creating directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Import and use the data generator
    const { generateScDataset, generateXeniumDataset, generateScStructure, generateXeniumStructure, transformDataFrame } = 
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
      }
    };

    const generator = generators[type];
    const dataPath = path.join(outputDir, 'data.json');
    const structurePath = path.join(outputDir, 'structure.json');

    console.log(`📊 Generating data for ${generator.label}...`);
    const data = generator.dataFun();

    console.log(`🏗️  Generating structure for ${generator.label}...`);
    const structure = generator.structureFun();

    console.log('💾 Writing data and structure to JSON files...');
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    fs.writeFileSync(structurePath, JSON.stringify(structure, null, 2));

    console.log(`✅ ${generator.label} generated successfully!`);
    console.log(`   Data: ${dataPath}`);
    console.log(`   Structure: ${structurePath}`);
    console.log('');
    console.log('🚀 Next steps:');
    console.log(`   qc-report render --data ${dataPath} --structure ${structurePath} --output ./report.html`);
    
  } catch (error) {
    console.error(`❌ Failed to generate ${type} dataset:`, error.message);
    process.exit(1);
  }
}

function renderReport(options) {
  console.log('🚀 Rendering QC Report...');
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

    console.log(`✅ QC Report rendered successfully: ${options.output}`);

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
    console.error('❌ Render failed:', error.message);
    console.error('\n💡 Make sure you have all dependencies installed in the package directory');
    process.exit(1);
  }
}

function showVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  console.log(`QC Report Generator v${packageJson.version}`);
}

async function main() {
  try {
    const options = parseArgs();

    switch (options.command) {
      case 'help':
        showHelp();
        break;
        
      case 'version':
        showVersion();
        break;
        
      case 'generate-test-data':
        await generateTestData(options.type, options.outputDir);
        break;
        
      case 'render':
        const validatedOptions = validateRenderOptions(options);
        // Add template directory for render
        validatedOptions.templateDir = __dirname;
        renderReport(validatedOptions);
        break;
        
      default:
        console.error(`❌ Unknown command: ${options.command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
