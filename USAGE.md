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

### Method 1: Simple workflow (Recommended)

1. **Prepare your data files:**
```bash
mkdir my-experiment/
# Copy your data files with specific names
cp your-data.json my-experiment/data.json
cp your-structure.json my-experiment/structure.json
```

2. **Generate the report:**
```bash
qc-report --data ./my-experiment/data.json --structure ./my-experiment/structure.json --output ./my-experiment-report.html
```

3. **Open the report:**
```bash
open my-experiment-report.html  # macOS
# or
xdg-open my-experiment-report.html  # Linux
```

### Method 2: Batch processing multiple experiments

```bash
# Process multiple experiments
for experiment in exp1 exp2 exp3; do
  qc-report \
    --data ./experiments/$experiment/data.json \
    --structure ./experiments/$experiment/structure.json \
    --output ./reports/$experiment-report.html
done
```

## CLI Reference

### Command Syntax

```bash
qc-report --data <file> --structure <file> --output <file> [options]
```

### Required Arguments

- `--data <file>`: Path to your data.json file
- `--structure <file>`: Path to your structure.json file  
- `--output <file>`: Output HTML file path

### Optional Arguments

- `--payload <file>`: Use existing compressed payload file (skips compression)
- `--no-auto-generate`: Don't auto-generate payload if missing
- `--help`: Show help message

### Examples

```bash
# Basic usage
qc-report --data ./data.json --structure ./structure.json --output ./report.html

# Use cached payload for faster builds
qc-report --data ./data.json --structure ./structure.json --output ./report.html --payload ./cached.bin

# Reuse existing payload only (fastest)
qc-report --payload ./cached.bin --output ./report.html --no-auto-generate
```

## Advanced Usage

### Use cached payloads for faster builds

For large datasets, you can cache the compressed payload to speed up repeated builds:

```bash
# First build - generates and caches payload
qc-report --data ./large-dataset/data.json --structure ./large-dataset/structure.json --output ./report1.html --payload ./cache/large-payload.bin

# Subsequent builds with same data - reuses cached payload (much faster)
qc-report --payload ./cache/large-payload.bin --output ./report2.html --no-auto-generate
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

# Use local version with test data
node cli.js --data ./resources_test/sc_dataset_small/data.json --structure ./resources_test/sc_dataset_small/structure.json --output ./test-report.html
```

## File Requirements

### data.json

Your data file should contain the QC metrics in columnar format:

```json
{
  "cell_rna_stats": {
    "num_rows": 1000,
    "num_cols": 4,
    "columns": [
      {
        "name": "sample_id",
        "dtype": "categorical", 
        "data": [0, 0, 1, 1, ...],
        "categories": ["sample_1", "sample_2"]
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

**Data Types Supported:**
- `categorical`: Integer indices with `categories` array (for sample IDs, cell types, etc.)
- `integer`: Whole numbers (counts, gene numbers, etc.)
- `numeric`: Floating point numbers (coordinates, fractions, etc.)
- `boolean`: True/false values

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
          "groupBy": "sample_id",
          "cutoffMin": null,
          "cutoffMax": null
        },
        {
          "type": "histogram",
          "visualizationType": "spatial",
          "field": "total_counts",
          "label": "spatial expression"
        }
      ]
    }
  ]
}
```

**Visualization Types:**
- `histogram`: Distribution plots with filtering capabilities
- `bar`: Bar charts for categorical data
- `scatter`: 2D scatter plots (use `yField` parameter)
- `spatial`: Spatial plots (use `visualizationType: "spatial"`)

## Environment Variables

You can set these environment variables to customize default behavior:

- `QC_DATA_PATH`: Default path to data.json file 
- `QC_STRUCTURE_PATH`: Default path to structure.json file
- `QC_PAYLOAD_PATH`: Default path for compressed payload file
- `QC_AUTO_GENERATE`: Whether to auto-generate payload from data files (default: `true`)

## Output

The build process creates a single, self-contained HTML file that includes:
- All visualization code and dependencies
- Compressed data payload (typically 20-50MB)
- Interactive charts and filtering capabilities
- No external dependencies required

The generated report can be opened directly in any modern web browser without requiring a web server.
