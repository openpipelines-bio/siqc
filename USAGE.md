# QC Report Generator - Usage Guide

The QC Report Generator is now available as an installable CLI package! This guide shows you how to install and use it.

## Installation

Install globally to use the `qc-report` command anywhere:

```bash
npm install -g qc-report-generator
# or
pnpm install -g qc-report-generator
```

Verify your installation:
```bash
qc-report --help
```

## Quick Start

### Method 1: Simple directory-based workflow (Recommended)

1. **Prepare your data directory:**
```bash
mkdir my-experiment/
cp your-data.json my-experiment/data.json
cp your-structure.json my-experiment/structure.json
```

2. **Generate the report:**
```bash
qc-report --data-dir ./my-experiment/ --output ./my-experiment-report.html
```

3. **Open the report:**
```bash
open my-experiment-report.html  # macOS
# or
xdg-open my-experiment-report.html  # Linux
```

### Method 2: Specify individual files

```bash
qc-report --data ./path/to/data.json --structure ./path/to/structure.json --output ./my-report.html
```

### Method 3: Batch processing multiple experiments

```bash
# Process multiple experiments
for experiment in exp1 exp2 exp3; do
  qc-report --data-dir ./experiments/$experiment/ --output ./reports/$experiment-report.html
done
```

## Advanced Usage

### Use cached payloads for faster builds

For large datasets, you can cache the compressed payload to speed up repeated builds:

```bash
# First build - generates and caches payload
qc-report --data-dir ./large-dataset/ --payload ./cache/large-payload.bin

# Subsequent builds with different structure - reuses cached payload (much faster)
qc-report --payload ./cache/large-payload.bin --structure ./new-structure.json --no-auto-generate
```

### Development/Local Installation

If you want to use the package locally or contribute to development:

```bash
# Clone and install
git clone https://github.com/openpipelines-bio/qc_report_generator.git
cd qc_report_generator
pnpm install

# Test the CLI locally
node cli.js --help

# Run installation test
npm run test:install

# Use local version
node cli.js --data-dir ./resources_test/sc_dataset_small/ --output ./test-report.html
```
- **Output**: `dist/index.html`

## File Requirements

### data.json
Your data file should contain the QC metrics in the expected format:

```json
{
  "cell_rna_stats": {
    "columns": [
      {
        "name": "sample_id",
        "dtype": "categorical", 
        "data": [0, 0, 1, 1, ...]
      },
      {
        "name": "total_counts",
        "dtype": "integer",
        "data": [459, 643, 713, ...]
      },
      {
        "name": "x_coord",
        "dtype": "numeric", 
        "data": [397.5, 408.7, 426.1, ...]
      },
      {
        "name": "y_coord",
        "dtype": "numeric",
        "data": [298.4, 303.2, 298.6, ...]
      }
    ]
  }
}
```

### structure.json
Your structure file should define the report layout and filters:

```json
{
  "categories": [
    {
      "name": "Cell RNA QC",
      "key": "cell_rna_stats", 
      "additionalAxes": true,
      "defaultFilters": [
        {
          "type": "histogram",
          "field": "total_counts",
          "label": "total counts",
          "nBins": 50,
          "groupBy": "sample_id"
        }
      ]
    }
  ]
}
```

## Environment Variables

- `QC_DATA_PATH`: Path to your data.json file (default: `data/data.json`)
- `QC_STRUCTURE_PATH`: Path to your structure.json file (default: `data/structure.json`)
- `QC_PAYLOAD_PATH`: Path to store/read compressed payload (default: `qc-report-payload.bin`)
- `QC_AUTO_GENERATE`: Whether to auto-generate payload from data files (default: `true`)

## Output

The build process creates a single, self-contained HTML file that includes:
- All visualization code and dependencies
- Compressed data payload (typically 20-50MB)
- Interactive charts and filtering capabilities
- No external dependencies required

The generated report can be opened directly in any modern web browser without requiring a web server.
