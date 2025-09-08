# QC Report Generator

[![npm version](https://badge.fury.io/js/qc-report-generator.svg)](https://badge.fury.io/js/qc-report-generator)

Generate interactive QC reports from scientific data with progressive loading and spatial visualization. Perfect for single-cell genomics, spatial transcriptomics, and other large-scale biological datasets.

## Features

- 🚀 **Progressive Loading**: Large datasets (millions of cells) load incrementally without blocking the UI
- 📊 **Interactive Visualizations**: Histograms, scatter plots, heatmaps, and spatial plots with Plotly.js
- 🗜️ **Efficient Compression**: Binary data format with gzip compression for optimal file sizes
- � **Standalone Reports**: Single HTML file with no external dependencies
- 🎯 **Spatial Analysis**: Advanced spatial plotting with faceting and optimization
- ⚡ **Performance Optimized**: Web Workers, typed arrays, and multi-scale rendering
- 🛠️ **Easy CLI**: Simple command-line interface for quick report generation

## Installation

Install globally to use the `qc-report` command anywhere:

```bash
npm install -g qc-report-generator
# or
pnpm install -g qc-report-generator
# or  
yarn global add qc-report-generator
```

Or install locally in your project:

```bash
npm install qc-report-generator
npx qc-report --help
```

## Quick Start

### 1. Prepare Your Data

Create a directory with your data files:

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

## Usage

### Basic Commands

```bash
# Generate report (all arguments required)
qc-report --data ./data.json --structure ./structure.json --output ./report.html

# Use existing compressed payload (faster for repeated builds)
qc-report --payload ./cached-payload.bin --output ./report.html
```

### Advanced Options

```bash
qc-report [options]

Required arguments:
  --data       Path to data JSON file
  --structure  Path to structure JSON file  
  --output     Output HTML file path

Optional arguments:
  --payload    Use existing compressed payload file (skips data/structure)
  --help       Show this help message
```

## Usage

### Basic Commands

```bash
# Generate report from a directory
qc-report --data-dir ./my-data/

# Generate report with specific files  
qc-report --data ./data.json --structure ./structure.json

# Custom output location
qc-report --data-dir ./data/ --output ./reports/experiment-1.html

# Use existing compressed payload (faster for repeated builds)
qc-report --payload ./cached-payload.bin --no-auto-generate
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

Define your report layout and visualizations:

```json
{
  "title": "Quality Control Report",
  "subtitle": "Single Cell RNA-seq Analysis", 
  "defaultFilters": {},
  "groups": [
    {
      "title": "Cell Statistics",
      "plots": [
        {
          "title": "Total RNA Counts",
          "plotType": "histogram",
          "field": "total_counts",
          "label": "total counts",
          "nBins": 50,
          "groupBy": "sample_id"
        },
        {
          "title": "Spatial Distribution",
          "plotType": "spatial",
          "xField": "x_coord",
          "yField": "y_coord", 
          "colorField": "total_counts",
          "groupBy": "sample_id"
        }
      ]
    }
  ]
}
```

## Supported Plot Types

- **histogram**: Distribution plots with automatic binning
- **scatterplot**: 2D scatter plots with color mapping
- **spatial**: Spatial coordinate plots with faceting 
- **heatmap**: Correlation and expression heatmaps
- **barplot**: Categorical data visualization

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

# Development server
pnpm dev

# Build package
pnpm build

# Test CLI locally  
node cli.js --help
```

### Architecture

- **SolidJS + Vite**: Fast, reactive frontend with optimized bundling
- **Progressive Loading**: Data decompression in Web Workers using Compression Streams API
- **Columnar Data**: Typed arrays (Float32Array, Int32Array) for memory efficiency
- **Single File Output**: Everything embedded in one HTML file for easy distribution

## Examples

See the `resources_test/` directory for example datasets and structures.

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
