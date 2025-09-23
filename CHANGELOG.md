# siqc 0.2.0

## Breaking Changes
* Requires Node.js ≥18.0.0
* Data format changed from JSON to compressed binary format
* CLI interface replaces manual build steps

## New Functionality
* CLI tool with `qc-report` command for generating reports
* Progressive loading with Web Workers for instant UI rendering
* Optimized spatial heatmap component with per-sample binning

## Major Changes
* Binary data format with 5-10x compression and typed arrays
* Vite plugin for payload injection during build
* Performance monitoring with real-time metrics

# siqc 0.1.0

Initial release of the Standalone Interactive Quality Control (siqc) package.

## Features

* Standalone interactive QC reports for single-cell RNA-seq and spatial transcriptomics data
* Currently supports single-cell RNA-seq data (CellRanger Multi) and spatial transcriptomics (Xenium)
* Comprehensive visualization suite: histograms, scatter plots, heatmaps, and spatial plots using Plotly.js
* Filter-based cell quality assessment with real-time updates and pass/fail statistics
* Sample comparison and batch analysis capabilities
* Responsive design with SolidJS framework and Tailwind CSS styling
* Standalone HTML output with embedded data for easy sharing and deployment
