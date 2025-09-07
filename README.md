# incubator-ingestion-qc

This is a project to visualize the ingestion qc data. Currently, 2 types of data are supported:

- Single-cell (CellRanger ingestion)
- Xenium (spatial transcriptomics)

## Live Demo Reports

The CI automatically builds example reports for different dataset sizes in parallel:

| Dataset Type | Size | Description | CI Artifact Name |
|--------------|------|-------------|------------------|
| Single-cell (small) | ~20 cells, 4KB | Basic single-cell QC | `single-cell-report` |
| Single-cell (large) | ~1.2M cells, 68MB | Large-scale single-cell QC | `single-cell-large-report` |
| Xenium (small) | Small spatial dataset | Basic spatial QC | `spatial-report` |
| Xenium (large) | ~1.2M cells, 100MB | Large-scale spatial QC | `spatial-large-report` |

**📥 How to access reports:**
1. Go to the [Actions tab](https://github.com/openpipelines-bio/qc_report_generator/actions)
2. Click on the latest successful workflow run
3. Scroll down to "Artifacts" section
4. Download any of the report artifacts above
5. Extract and open the `.html` file in your browser

*All reports are self-contained HTML files with embedded data - no server required!*

## Usage

Install dependencies:

```bash
pnpm install
```

Generate test data:
```bash
# Small datasets (~4KB)
Rscript scripts/generate_data.R sc resources_test/sc_dataset
Rscript scripts/generate_data.R xenium resources_test/xenium_dataset

# Large datasets (~45-68MB, 1.2M cells) 
Rscript scripts/generate_data.R sc_large resources_test/sc_dataset_large
Rscript scripts/generate_data.R xenium_large resources_test/xenium_dataset_large
```

### Generate Single-Cell Report

Compress single-cell input data:

```bash
# For small dataset
pnpm run compress_data resources_test/sc_dataset/structure.json src/data/report_structure.ts
pnpm run compress_data resources_test/sc_dataset/data.json src/data/dataset.ts

# For large dataset
pnpm run compress_data resources_test/sc_dataset_large/structure.json src/data/report_structure.ts
pnpm run compress_data resources_test/sc_dataset_large/data.json src/data/dataset.ts
```

Generate single-cell report:
```bash
pnpm run build
```

The report should now have been built at `dist/index.html`

### Generate Xenium Report

Compress Xenium input data:

```bash
# For small spatial dataset
pnpm run compress_data resources_test/xenium_dataset/structure.json src/data/report_structure.ts
pnpm run compress_data resources_test/xenium_dataset/data.json src/data/dataset.ts

# For large spatial dataset (1.2M cells)
pnpm run compress_data resources_test/xenium_dataset_large/structure.json src/data/report_structure.ts
pnpm run compress_data resources_test/xenium_dataset_large/data.json src/data/dataset.ts
```

Generate Xenium report:
```bash
pnpm run build
```

The report should now have been built at `dist/index.html`

## Available Scripts

In the project directory, you can run:

### `pnpm install`

Run this command to install the dependencies of the project.

### `pnpm run compress_data`

Enhanced data compression script that supports both legacy and new formats:

**Legacy TypeScript modules (backward compatibility):**
```bash
pnpm run compress_data data.json src/data/dataset.ts
```

**New columnar binary format (for progressive loading):**
```bash
pnpm run compress_data data.json payload.txt structure.json
```

The script automatically detects the output format based on file extensions and arguments.

### `pnpm run test-format`

Tests the new columnar binary format and compares compression ratios:
```bash
pnpm run test-format [payload.txt] [data.json] [structure.json]
```

### `pnpm run dev`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>

### `pnpm run build`

Builds the app for production to the `dist` folder.<br>
It correctly bundles the application in production mode and optimizes the build for the best performance.

## Performance Features

This QC report generator is optimized for large datasets with several performance features:

### 🚀 Progressive Loading
- **Progressive data hydration**: Charts load incrementally as they come into view
- **Web Worker decompression**: Data decompression happens in background workers
- **Columnar data format**: Efficient storage and loading of specific data columns
- **Intelligent caching**: Previously loaded data is cached for instant re-rendering

### 📊 Performance Monitoring
- **Real-time performance dashboard**: Monitor loading times and memory usage
- **First paint tracking**: Measure time to initial UI render
- **Chart-level metrics**: Individual timing for each visualization component
- **Memory footprint tracking**: Monitor memory usage patterns

### 📈 Parallel Processing
- **Parallel data loading**: Multiple data columns load simultaneously
- **Background preloading**: Common data preloads while UI renders
- **Non-blocking operations**: UI remains responsive during data processing

These optimizations enable smooth interaction with datasets containing 1M+ cells while maintaining sub-second initial render times.

Builds the app for production to the `dist` folder.<br>
It correctly bundles Solid in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

### `pnpm run prettier`

Runs prettier on the project.

## Documentation

* State management: [Solid Core](https://docs.solidjs.com/)

* Styling: [Tailwind CSS](https://tailwindcss.com/docs)

* Component library: [Solid UI](https://www.solid-ui.com/docs/components/accordion)
