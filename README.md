# `siqc`: Generate standalone interactive QC reports from scientific data

Generate interactive QC reports from scientific data with progressive loading and spatial visualization. Perfect for single-cell genomics, spatial transcriptomics, and other large-scale biological datasets.

## Features

- 🚀 **Progressive Loading**: Large datasets (millions of cells) load incrementally without blocking the UI
- 📊 **Interactive Visualizations**: Histograms, scatter plots, heatmaps, and spatial plots with Plotly.js
- 🗜️ **Efficient Compression**: Binary data format with gzip compression for optimal file sizes
- 📄 **Standalone Reports**: Single HTML file with no external dependencies
- 🎯 **Spatial Analysis**: Advanced spatial plotting with faceting and optimization
- ⚡ **Performance Optimized**: Web Workers, typed arrays, and multi-scale rendering
- 🛠️ **Easy CLI**: Simple command-line interface for quick report generation

## Installation

### From Git Repository (Recommended)

```bash
# Install globally from git repository
npm install -g git+https://github.com/openpipelines-bio/siqc.git
# or
pnpm install -g git+https://github.com/openpipelines-bio/siqc.git
```

### Local Development

```bash
git clone https://github.com/openpipelines-bio/siqc.git
cd siqc
pnpm install
# In the following sections, CLI is now available via `pnpm cli`, not `siqc`
```

## Quick Start

### 1. Generate Example Data

```bash
# Generate single-cell test data
siqc generate-test-data --type sc --output ./example-data

# Generate spatial test data  
siqc generate-test-data --type xenium --output ./spatial-data
```

### 2. Create Your First Report

```bash
# Render report from test data
siqc render --data ./example-data/data.json --structure ./example-data/structure.json --output ./my-report.html

# Open the report in your browser
open my-report.html
```

### 3. Use Your Own Data

Prepare your data in the required format (see [Data Format](#data-format)) and render:

```bash
siqc render --data ./my-qc-data/data.json --structure ./my-qc-data/structure.json --output ./my-qc-report.html
```

## CLI Reference

### Commands

#### `generate-test-data`
Generate example datasets for testing and development.

```bash
siqc generate-test-data --type <type> --output <directory>
```

**Options:**
- `--type, -t`: Dataset type (`sc`, `sc_large`, `xenium`, `xenium_large`)
- `--output, -o`: Output directory for generated files
- `--verbose`: Enable verbose logging

**Examples:**
```bash
siqc generate-test-data --type sc --output ./test-data
siqc generate-test-data --type xenium_large --output ./large-spatial --verbose
```

#### `render`
Generate QC report from existing data.

```bash
siqc render --data <file> --structure <file> --output <file> [options]
```

**Options:**
- `--data, -d`: Path to data JSON file (required)
- `--structure, -s`: Path to structure JSON file (required)
- `--output, -o`: Output HTML file path (required)
- `--payload, -p`: Path to binary payload file (auto-generated if not specified)
- `--auto-generate`: Auto-generate payload file if not specified (default: true)
- `--verbose`: Enable verbose logging

**Examples:**
```bash
siqc render --data ./data.json --structure ./structure.json --output ./report.html
siqc render --data ./data.json --structure ./structure.json --output ./report.html --payload ./cached-payload.bin
```

#### `compress`
Compress data to binary payload format for faster loading.

```bash
siqc compress --data <file> --structure <file> --output <file>
```

**Options:**
- `--data, -d`: Path to input data JSON file (required)
- `--structure, -s`: Path to structure JSON file (required)
- `--output, -o`: Output binary payload file path (required)
- `--verbose`: Enable verbose logging

**Examples:**
```bash
siqc compress --data data.json --structure structure.json --output payload.bin
```

## Data Format

### data.json

Your data should be in columnar format for optimal performance:

```json
{
  "cell_rna_stats": {
    "columns": [
      {
        "name": "sample_id",
        "dtype": "categorical",
        "data": [0, 0, 1, 1, 2],
        "categories": ["sample_A", "sample_B", "sample_C"]
      },
      {
        "name": "total_counts",
        "dtype": "integer",
        "data": [1200, 1500, 800, 2000, 1100]
      },
      {
        "name": "fraction_mitochondrial",
        "dtype": "numeric", 
        "data": [0.05, 0.08, 0.12, 0.03, 0.07]
      }
    ]
  },
  "spatial_coords": {
    "columns": [
      {
        "name": "x_coord",
        "dtype": "numeric",
        "data": [100.5, 200.3, 300.1, 150.7, 250.9]
      },
      {
        "name": "y_coord", 
        "dtype": "numeric",
        "data": [50.2, 75.8, 90.3, 120.5, 80.1]
      }
    ]
  }
}
```

### structure.json

Define the report structure and categories:

```json
{
  "title": "My QC Report",
  "categories": [
    {
      "key": "cell_rna_stats",
      "name": "Cell RNA Statistics",
      "additionalAxes": false,
      "defaultFilters": []
    },
    {
      "key": "spatial_coords", 
      "name": "Spatial Coordinates",
      "additionalAxes": true,
      "defaultFilters": []
    }
  ]
}
```

**Data Types:**
- `categorical`: Integer indices with category labels
- `integer`: Whole numbers
- `numeric`: Floating-point numbers
- `boolean`: True/false values

