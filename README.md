# QC Report Generator

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

Install globally from the git repository:

```bash
# Install from git repository
npm install -g git+https://github.com/openpipelines-bio/qc_report_generator.git
# or
pnpm install -g git+https://github.com/openpipelines-bio/qc_report_generator.git
```

Or clone and install locally for development:

```bash
git clone https://github.com/openpipelines-bio/qc_report_generator.git
cd qc_report_generator
pnpm install
pnpm run build
# CLI is now available as: node cli.js
```

## Quick Start

### 1. Prepare Your Data

Organize your data files:

```bash
mkdir my-qc-data/
# Copy your data files
cp experiment-data.json my-qc-data/data.json
cp experiment-structure.json my-qc-data/structure.json
```

### 2. Generate the Report

```bash
qc-report --data ./my-qc-data/data.json --structure ./my-qc-data/structure.json --output ./my-qc-report.html
```

### 3. View the Report

Open the generated HTML file in any modern web browser. No server required!

## CLI Usage

### Command Syntax

```bash
qc-report --data <file> --structure <file> --output <file> [options]
```

### Required Arguments

- `--data <file>`: Path to the data.json file
- `--structure <file>`: Path to the structure.json file  
- `--output <file>`: Output HTML file path

### Optional Arguments

- `--payload <file>`: Use existing compressed payload file (skips compression step)
- `--no-auto-generate`: Don't auto-generate payload if missing
- `--help`: Show help message

### Examples

```bash
# Basic usage
qc-report --data ./data.json --structure ./structure.json --output ./report.html

# Use cached payload for faster builds
qc-report --data ./data.json --structure ./structure.json --output ./report.html --payload ./cached-payload.bin

# Reuse existing payload (fastest)
qc-report --payload ./cached-payload.bin --output ./report.html --no-auto-generate
qc-report --payload ./cached-payload.bin --no-auto-generate
```

## Data Format

### data.json

Your data should be in columnar format for optimal performance:

```json
{
  "cell_rna_stats": {
    "num_rows": 1000,
    "num_cols": 5,
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
  },
  "sample_summary_stats": {
    "num_rows": 2,
    "num_cols": 3,
    "columns": [
      {
        "name": "sample_id",
        "dtype": "categorical",
        "data": [0, 1],
        "categories": ["sample_1", "sample_2"]
      }
    ]
  }
}
```

### structure.json

Define your report layout and visualizations:

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
          "label": "spatial expression",
          "xField": "x_coord",
          "yField": "y_coord"
        }
      ]
    },
    {
      "name": "Sample Summary",
      "key": "sample_summary_stats",
      "additionalAxes": false,
      "defaultFilters": []
    }
  ]
}
```

## Supported Visualization Types

- **histogram**: Distribution plots with automatic binning and filtering
- **scatter**: 2D scatter plots with color mapping (use `yField` parameter)
- **bar**: Bar charts for categorical data
- **spatial**: Spatial coordinate plots with heatmap overlay (use `visualizationType: "spatial"`)

## Filter Options

Each visualization supports filtering options:

- `cutoffMin`/`cutoffMax`: Numeric thresholds for filtering data
- `zoomMin`/`zoomMax`: Zoom range for better visualization
- `groupBy`: Group data by categorical variables
- `nBins`: Number of bins for histograms

## Performance Features

- **Progressive Loading**: UI renders immediately, data loads in background
- **Web Workers**: Data decompression happens off the main thread  
- **Typed Arrays**: Memory-efficient data storage (Float32Array, Int32Array)
- **Multi-scale Rendering**: Automatic optimization for large spatial datasets
- **Compression**: Typical compression ratios of 5-10x with gzip

## Live Demo Reports

The CI automatically builds example reports for different dataset sizes:

| Dataset Type | Size | Description | Report |
|--------------|------|-------------|--------|
| Single-cell (small) | ~20 cells, 4KB | Basic single-cell QC | [Download](https://github.com/openpipelines-bio/qc_report_generator/actions) |
| Single-cell (large) | ~1.2M cells, 68MB | Large-scale single-cell QC | [Download](https://github.com/openpipelines-bio/qc_report_generator/actions) |
| Xenium (small) | Small spatial dataset | Basic spatial QC | [Download](https://github.com/openpipelines-bio/qc_report_generator/actions) |
| Xenium (large) | ~1.2M cells, 100MB | Large-scale spatial QC | [Download](https://github.com/openpipelines-bio/qc_report_generator/actions) |

Access reports from the [GitHub Actions artifacts](https://github.com/openpipelines-bio/qc_report_generator/actions).

## Development

Clone and install for development:

```bash
git clone https://github.com/openpipelines-bio/qc_report_generator.git
cd qc_report_generator
pnpm install

# Generate test data (requires R with required packages)
Rscript scripts/generate_data.R

# Development server
pnpm dev

# Build package
pnpm build

# Test CLI locally  
node cli.js --help

# Test with generated data
node cli.js --data resources_test/sc_dataset/data.json --structure resources_test/sc_dataset/structure.json --output test-report.html
```

### Architecture

- **SolidJS + Vite**: Fast, reactive frontend with optimized bundling
- **Progressive Loading**: Data decompression in Web Workers using Compression Streams API
- **Columnar Data**: Typed arrays (Float32Array, Int32Array) for memory efficiency
- **Single File Output**: Everything embedded in one HTML file for easy distribution

## Examples

See the `resources_test/` directory for example datasets and structures.

### Generating Test Data

Use the included R script to generate sample datasets for testing:

```bash
# Generates multiple test datasets in resources_test/
Rscript scripts/generate_data.R
```

This creates example data for:
- `sc_dataset/` - Small single-cell dataset (~20 cells)
- `sc_dataset_large/` - Large single-cell dataset (~1.2M cells)  
- `xenium_dataset/` - Small Xenium spatial dataset
- `xenium_dataset_large/` - Large Xenium spatial dataset (~1.2M cells)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Citation

If you use this tool in your research, please cite:

```bibtex
@software{qc_report_generator,
  title = {QC Report Generator: Interactive Quality Control Reports for Scientific Data},
  author = {OpenPipelines Bio},
  url = {https://github.com/openpipelines-bio/qc_report_generator},
  year = {2025}
}
```
