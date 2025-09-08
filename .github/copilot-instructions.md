# QC Report Generator - AI Coding Instructions

## Architecture Overview

This is a **progressive loading QC report generator** for scientific data analysis, built with **SolidJS + Vite**. The core innovation is a **binary data format with Web Workers** that enables instant UI rendering while large datasets (millions of cells) load asynchronously.

### Key Components

- **CLI Tool** (`cli.js`): Node.js command-line interface for report generation
- **Progressive Data System** (`src/lib/data-loader.ts`, `src/lib/loader.worker.ts`): Web Worker-based decompression using `DecompressionStream` API
- **Binary Format** (`src/lib/data-types.ts`): Typed arrays (`Float32Array`, `Int32Array`) for memory efficiency  
- **Payload Plugin** (`plugins/inject-payload-plugin.ts`): Vite plugin that embeds compressed data into HTML during build
- **Chart Components** (`src/components/`): Progressive loading visualizations with viewport detection

## Critical Workflows

### Development Setup
```bash
# Generate test data (requires R)
Rscript scripts/generate_data.R

# Development with environment variables
cp .env.example .env  # Configure data paths
pnpm dev

# Test CLI locally
node cli.js --data resources_test/sc_dataset/data.json --structure resources_test/sc_dataset/structure.json --output test.html
```

### Build Process
The build injects compressed binary payload directly into HTML via `injectPayloadPlugin`. Environment variables control data sources:
- `QC_DATA_PATH` / `QC_STRUCTURE_PATH`: Input JSON files
- `QC_PAYLOAD_PATH`: Compressed binary cache file
- `QC_AUTO_GENERATE`: Auto-generate payload if missing

## Project-Specific Patterns

### Data Loading Architecture
- **Legacy Mode**: Synchronous JSON loading (fallback)
- **Progressive Mode**: Binary format with Web Worker decompression
- **Dual API**: Components work with both modes via `progressiveDataAdapter`

```typescript
// Always use progressive adapter, not direct data access
import { progressiveDataAdapter } from '~/lib/progressive-data-adapter';
const data = await progressiveDataAdapter.loadCategoryData('cell_rna_stats');
```

### Component Progressive Loading
Use `ProgressiveWrapper` for charts that need viewport-triggered loading:

```tsx
<ProgressiveWrapper 
  title="Chart Title"
  dataLoader={async () => await loadChartData()}
>
  {(data) => <MyChart data={data} />}
</ProgressiveWrapper>
```

### Filter Validation Pattern
**Critical**: Always check for both `null` AND `undefined` in filter logic:

```typescript
// CORRECT - handles both null and undefined
if ((cutoffMin !== undefined && cutoffMin !== null && value < cutoffMin) ||
    (cutoffMax !== undefined && cutoffMax !== null && value > cutoffMax)) {
  // filter logic
}
```

### Performance Monitoring
Use built-in performance tracking for new features:

```typescript
import { startChartMetric, markChartRenderEnd } from '~/lib/performance-monitor';
const metric = startChartMetric('chart-id', 'Chart Title');
// ... rendering code ...
markChartRenderEnd('chart-id');
```

## Data Format Conventions

### Input Data Structure
- **Columnar Format**: `{ columns: [{ name, dtype, data, categories? }] }`
- **Categories**: `'categorical'` uses integer indices + categories array
- **Types**: `'integer'`, `'numeric'`, `'categorical'`, `'boolean'`

### Binary Format
- **Header**: JSON metadata (columns, types, offsets)
- **Data**: Aligned typed arrays after header
- **Compression**: Gzip-compressed before base64 encoding

## Common Pitfalls

1. **Don't use generic imports**: Always import specific functions to avoid circular dependencies
2. **Environment Variables**: Use `.env` for development, not hardcoded paths
3. **Memory Management**: Transfer ArrayBuffers between worker and main thread to avoid copies
4. **Filter Logic**: Null/undefined confusion causes filter bugs - always check both
5. **Spatial Data**: Large spatial datasets need precomputed binning, not raw coordinate rendering

## Key Files for Context

- `src/App.tsx`: Main application with progressive initialization
- `src/lib/data-loader.ts`: Core progressive loading logic
- `vite.config.ts`: Build configuration with payload injection
- `.env.example`: Development environment setup examples
- `src/types.ts`: Core type definitions for data structures
