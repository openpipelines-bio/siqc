/**
 * QC Data Generator - Node.js Library
 * 
 * Generates synthetic QC datasets for testing and development.
 * Supports single-cell and spatial (Xenium) datasets.
 * 
 * This module provides library functions for data generation.
 * Use the main CLI (cli.js) for command-line interface.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



// Utility functions for random number generation
class Random {
  constructor(seed = 42) {
    this.seed = seed;
  }

  // Simple seeded random number generator (LCG)
  random() {
    this.seed = (this.seed * 1664525 + 1013904223) % (2 ** 32);
    return this.seed / (2 ** 32);
  }

  // Normal distribution using Box-Muller transform
  normal(mean = 0, std = 1) {
    const u1 = this.random();
    const u2 = this.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * std + mean;
  }

  // Uniform distribution
  uniform(min = 0, max = 1) {
    return min + this.random() * (max - min);
  }

  // Integer in range
  randint(min, max) {
    return Math.floor(this.uniform(min, max + 1));
  }

  // Sample from array
  sample(array, size = 1, replace = true) {
    const result = [];
    for (let i = 0; i < size; i++) {
      const index = Math.floor(this.random() * array.length);
      result.push(array[index]);
      if (!replace) {
        array.splice(index, 1);
      }
    }
    return size === 1 ? result[0] : result;
  }

  // Generate random string
  randomString(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(this.random() * chars.length)];
    }
    return result;
  }
}

// Data transformation utilities
function getSampleStat(data, sampleId, func, sampleIdArray) {
  const sampleData = data.filter((_, i) => sampleIdArray[i] === sampleId);
  return func(sampleData);
}

function transformDataFrame(data, metadata = {}) {
  const columns = Object.keys(data).map(name => {
    const values = data[name];
    const firstValue = values.find(v => v !== null && v !== undefined);
    
    let dtype;
    let processedData = values;
    let categories;

    if (firstValue === null || firstValue === undefined) {
      dtype = 'numeric';
    } else if (typeof firstValue === 'boolean') {
      dtype = 'boolean';
    } else if (typeof firstValue === 'string') {
      dtype = 'categorical';
      // Optimized categorical conversion using Map for O(1) lookups
      const uniqueMap = new Map();
      const uniqueValues = [];
      let nextIndex = 0;
      
      // Single pass to build unique values and mapping
      for (const value of values) {
        if (value !== null && !uniqueMap.has(value)) {
          uniqueMap.set(value, nextIndex);
          uniqueValues.push(value);
          nextIndex++;
        }
      }
      
      categories = uniqueValues;
      // Fast conversion using Map lookup (O(1) per value)
      processedData = values.map(v => v === null ? null : uniqueMap.get(v));
    } else if (Number.isInteger(firstValue)) {
      dtype = 'integer';
    } else if (typeof firstValue === 'number') {
      dtype = 'numeric';
    } else {
      throw new Error(`Unknown data type for column ${name}: ${typeof firstValue}`);
    }

    const column = {
      name,
      dtype,
      data: processedData
    };

    if (categories) {
      column.categories = categories;
    }

    return column;
  });

  return {
    num_rows: data[Object.keys(data)[0]]?.length || 0,
    num_cols: columns.length,
    min_total_counts: 10,
    min_num_nonzero_vars: 10,
    ...metadata,
    columns
  };
}

// Single-cell dataset generator
function generateScDataset({
  numSamples = 2,
  cellsPerSample = 10,
  totalCountsRange = [10, 56],
  nonzeroVarsRange = [10, 46],
  cellbenderBackgroundMean = 0.4,
  cellbenderBackgroundSd = 0.2,
  cellSizeBase = 15,
  cellSizeSd = 10,
  dropletEfficiencyBase = 0.93,
  dropletEfficiencyRange = 0.05,
  mitoFractionMean = 0.08,
  mitoFractionSd = 0.05,
  riboFractionMean = 0.12,
  riboFractionSd = 0.06
} = {}) {
  const rng = new Random(42);
  const totalCells = numSamples * cellsPerSample;
  const sampleIds = Array.from({ length: numSamples }, (_, i) => `sample_${i + 1}`);

  // Generate sample-specific characteristics
  const sampleCharacteristics = sampleIds.map((_, i) => {
    const rngSample = new Random(42 + i * 100); // Different seed per sample
    return {
      // Each sample has different quality characteristics
      totalCountMultiplier: rngSample.uniform(0.7, 1.5), // Sample quality variation
      mitoFractionBase: Math.max(0.02, rngSample.normal(mitoFractionMean, mitoFractionSd * 0.5)),
      riboFractionBase: Math.max(0.05, rngSample.normal(riboFractionMean, riboFractionSd * 0.5)),
      cellSizeMultiplier: rngSample.uniform(0.8, 1.3),
      dropletEfficiencyMean: Math.min(0.98, Math.max(0.85, rngSample.normal(dropletEfficiencyBase, 0.03))),
      // Simulate different cell types or conditions per sample
      cellTypeProportions: [
        rngSample.uniform(0.3, 0.7), // Type A proportion
        rngSample.uniform(0.2, 0.5), // Type B proportion  
        rngSample.uniform(0.1, 0.3)  // Type C proportion
      ]
    };
  });

  // Generate cell data with sample-specific characteristics
  const cellRnaStats = {
    sample_id: [],
    total_counts: [],
    num_nonzero_vars: [],
    fraction_mitochondrial: [],
    fraction_ribosomal: [],
    cellbender_background_fraction: [],
    cellbender_cell_probability: [],
    cellbender_cell_size: [],
    cellbender_droplet_efficiency: []
  };

  for (let sampleIdx = 0; sampleIdx < numSamples; sampleIdx++) {
    const char = sampleCharacteristics[sampleIdx];
    const sampleRng = new Random(42 + sampleIdx * 100);
    
    for (let cellIdx = 0; cellIdx < cellsPerSample; cellIdx++) {
      // Assign cell type based on proportions
      const typeRand = sampleRng.random();
      let cellType = 0;
      if (typeRand > char.cellTypeProportions[0]) cellType = 1;
      if (typeRand > char.cellTypeProportions[0] + char.cellTypeProportions[1]) cellType = 2;
      
      // Cell type-specific multipliers
      const cellTypeMultipliers = [
        { totalCounts: 1.0, mito: 1.0, ribo: 1.0, genes: 1.0 },
        { totalCounts: 1.3, mito: 0.7, ribo: 1.4, genes: 1.2 }, // Higher expression
        { totalCounts: 0.6, mito: 1.8, ribo: 0.8, genes: 0.7 }  // Stressed cells
      ];
      const typeMultiplier = cellTypeMultipliers[cellType];

      cellRnaStats.sample_id.push(sampleIds[sampleIdx]);
      
      // Sample and cell-type specific total counts
      const baseCounts = sampleRng.randint(totalCountsRange[0], totalCountsRange[1]);
      cellRnaStats.total_counts.push(
        Math.round(baseCounts * char.totalCountMultiplier * typeMultiplier.totalCounts)
      );
      
      // Sample and cell-type specific gene counts
      const baseGenes = sampleRng.randint(nonzeroVarsRange[0], nonzeroVarsRange[1]);
      cellRnaStats.num_nonzero_vars.push(
        Math.round(baseGenes * typeMultiplier.genes)
      );
      
      // Sample and cell-type specific fractions
      cellRnaStats.fraction_mitochondrial.push(
        Math.max(0.001, Math.min(0.8, 
          sampleRng.normal(char.mitoFractionBase * typeMultiplier.mito, mitoFractionSd)
        ))
      );
      
      cellRnaStats.fraction_ribosomal.push(
        Math.max(0.01, Math.min(0.6,
          sampleRng.normal(char.riboFractionBase * typeMultiplier.ribo, riboFractionSd)
        ))
      );
      
      // Sample-specific technical characteristics
      cellRnaStats.cellbender_background_fraction.push(
        Math.max(0, sampleRng.normal(cellbenderBackgroundMean, cellbenderBackgroundSd)) *
        (sampleRng.random() > 0.3 ? 1 : 0)
      );
      
      cellRnaStats.cellbender_cell_probability.push(
        Math.max(sampleRng.random(), 0.0002)
      );
      
      cellRnaStats.cellbender_cell_size.push(
        Math.max(cellSizeBase * char.cellSizeMultiplier + sampleRng.normal(0, cellSizeSd), 
                cellSizeBase * 0.5)
      );
      
      cellRnaStats.cellbender_droplet_efficiency.push(
        char.dropletEfficiencyMean + sampleRng.random() * dropletEfficiencyRange
      );
    }
  }

  // Add outliers (stressed/dying cells) - but sample-specific
  const outlierCount = Math.round(totalCells * 0.03);
  const outlierIndices = Array.from({ length: outlierCount }, () => 
    Math.floor(rng.random() * totalCells)
  );
  outlierIndices.forEach(i => {
    cellRnaStats.fraction_mitochondrial[i] = Math.min(cellRnaStats.fraction_mitochondrial[i] * 2.5, 0.8);
  });

  // Generate sample summary stats
  const sampleSummaryStats = {
    sample_id: sampleIds,
    rna_num_barcodes: Array.from({ length: numSamples }, () => Math.round(cellsPerSample * 1.5)),
    rna_num_barcodes_filtered: Array.from({ length: numSamples }, () => cellsPerSample),
    rna_sum_total_counts: sampleIds.map(id => 
      getSampleStat(cellRnaStats.total_counts, id, arr => arr.reduce((a, b) => a + b, 0), cellRnaStats.sample_id)
    ),
    rna_median_total_counts: sampleIds.map(id =>
      getSampleStat(cellRnaStats.total_counts, id, arr => {
        const sorted = [...arr].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      }, cellRnaStats.sample_id)
    ),
    rna_overall_num_nonzero_vars: sampleIds.map(id =>
      getSampleStat(cellRnaStats.num_nonzero_vars, id, arr => Math.max(...arr) * 1.2, cellRnaStats.sample_id)
    ),
    rna_median_num_nonzero_vars: sampleIds.map(id =>
      getSampleStat(cellRnaStats.num_nonzero_vars, id, arr => {
        const sorted = [...arr].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      }, cellRnaStats.sample_id)
    )
  };

  // Generate cellranger metrics
  const metrics = [
    'Cells', 'Mean_reads_per_cell', 'Median_UMI_counts_per_cell',
    'Median_genes_per_cell', 'Sequencing_saturation', 'Fraction_reads_in_cells',
    'Total_genes_detected', 'Valid_barcodes'
  ];

  const rng2 = new Random(43);
  const metricsData = {
    sample_id: sampleIds
  };

  metrics.forEach(metric => {
    if (['Fraction', 'Sequencing_saturation', 'Valid'].some(word => metric.includes(word))) {
      // Fraction values between 0 and 1
      const value = Math.round(rng2.uniform(0.01, 0.99) * 10000) / 10000;
      metricsData[metric] = Array.from({ length: numSamples }, () => value);
    } else {
      // Integer values
      const value = Math.round(rng2.uniform(1, 10000));
      metricsData[metric] = Array.from({ length: numSamples }, () => value);
    }
  });

  return {
    cell_rna_stats: transformDataFrame(cellRnaStats),
    sample_summary_stats: transformDataFrame(sampleSummaryStats),
    metrics_cellranger_stats: transformDataFrame(metricsData)
  };
}

// Xenium dataset generator
function generateXeniumDataset({
  numSamples = 2,
  cellsPerSample = 10,
  totalCountsRange = [16, 78],
  nonzeroVarsRange = [1, 2],
  cellAreaRange = [30, 150],
  nucleusRatioRange = [0.1, 0.35],
  spatialNoise = 5,
  mitoFractionMean = 0.07,
  mitoFractionSd = 0.04,
  riboFractionMean = 0.10,
  riboFractionSd = 0.05
} = {}) {
  const rng = new Random(121);
  const totalCells = numSamples * cellsPerSample;

  // Generate sample-specific characteristics for spatial data
  const sampleCharacteristics = Array.from({ length: numSamples }, (_, i) => {
    const sampleRng = new Random(121 + i * 150);
    return {
      // Each sample represents different tissue regions or conditions
      tissueType: i % 3, // 0: cortex-like, 1: hippocampus-like, 2: tumor-like
      totalCountMultiplier: sampleRng.uniform(0.8, 1.3),
      mitoGradientStrength: sampleRng.uniform(0.2, 0.8), // Spatial gradient strength
      // Tissue-specific expression patterns
      expressionPattern: {
        highExpression: sampleRng.uniform(0.2, 0.4), // Proportion of high-expressing cells
        lowExpression: sampleRng.uniform(0.1, 0.3),   // Proportion of low-expressing cells
        mitoBase: Math.max(0.02, sampleRng.normal(mitoFractionMean, mitoFractionSd * 0.5)),
        riboBase: Math.max(0.05, sampleRng.normal(riboFractionMean, riboFractionSd * 0.5))
      }
    };
  });

  // Generate realistic spatial coordinates using 2D normal distribution
  function generateSpatialCoordinates(sampleIdx, cellsPerSample) {
    const char = sampleCharacteristics[sampleIdx];
    const sampleRng = new Random(121 + sampleIdx * 150);
    
    // Define comparable but randomized coordinate ranges for each sample
    // Base ranges are in the same order of magnitude (hundreds to low thousands)
    const baseRange = 1000; // Base coordinate range
    const rangeVariation = 0.4; // ±40% variation
    
    const xRange = baseRange * sampleRng.uniform(1 - rangeVariation, 1 + rangeVariation);
    const yRange = baseRange * sampleRng.uniform(1 - rangeVariation, 1 + rangeVariation);
    
    // Random offsets to separate samples spatially but keep ranges comparable
    const xOffset = sampleIdx * baseRange * 0.8 + sampleRng.uniform(-baseRange * 0.2, baseRange * 0.2);
    const yOffset = sampleIdx * baseRange * 0.6 + sampleRng.uniform(-baseRange * 0.2, baseRange * 0.2);
    
    // 2D normal distribution parameters
    const numClusters = Math.max(1, Math.floor(sampleRng.uniform(1, 4))); // 1-3 clusters per sample
    const clusters = [];
    
    for (let c = 0; c < numClusters; c++) {
      const correlation = sampleRng.uniform(-0.3, 0.3);
      clusters.push({
        // Center positions within the sample's coordinate space
        centerX: xOffset + sampleRng.uniform(0.2, 0.8) * xRange,
        centerY: yOffset + sampleRng.uniform(0.2, 0.8) * yRange,
        // Standard deviations for the 2D normal distribution
        stdX: xRange * sampleRng.uniform(0.1, 0.25), // 10-25% of range
        stdY: yRange * sampleRng.uniform(0.1, 0.25),
        // Pre-compute correlation terms for performance
        correlation: correlation,
        corrSqrt: Math.sqrt(1 - correlation * correlation), // Pre-compute expensive sqrt
        // Weight of this cluster (for multiple clusters)
        weight: sampleRng.uniform(0.3, 1.0)
      });
    }
    
    // Normalize cluster weights and pre-compute cumulative weights
    const totalWeight = clusters.reduce((sum, cluster) => sum + cluster.weight, 0);
    let cumWeight = 0;
    clusters.forEach(cluster => {
      cluster.weight /= totalWeight;
      cumWeight += cluster.weight;
      cluster.cumWeight = cumWeight;
    });
    
    const coords = [];
    
    // Pre-allocate normal variates in batches for better performance
    const batchSize = Math.min(cellsPerSample, 10000);
    let normalBatch = [];
    let batchIndex = 0;
    
    // Function to generate batch of normal variates
    const generateNormalBatch = () => {
      normalBatch = [];
      for (let i = 0; i < batchSize * 2; i += 2) {
        const u1 = sampleRng.random();
        const u2 = sampleRng.random();
        
        // Box-Muller transform - generate two normal variates at once
        const sqrt2log = Math.sqrt(-2 * Math.log(u1));
        const twoPiU2 = 2 * Math.PI * u2;
        normalBatch[i] = sqrt2log * Math.cos(twoPiU2);
        normalBatch[i + 1] = sqrt2log * Math.sin(twoPiU2);
      }
      batchIndex = 0;
    };
    
    for (let i = 0; i < cellsPerSample; i++) {
      // Refill batch if needed
      if (batchIndex >= normalBatch.length) {
        generateNormalBatch();
      }
      
      // Fast cluster selection using pre-computed cumulative weights
      let selectedCluster = clusters[0];
      if (clusters.length > 1) {
        const rand = sampleRng.random();
        for (const cluster of clusters) {
          if (rand <= cluster.cumWeight) {
            selectedCluster = cluster;
            break;
          }
        }
      }
      
      // Get normal variates from batch
      const z1 = normalBatch[batchIndex++];
      const z2 = normalBatch[batchIndex++];
      
      // Apply correlation and scaling using pre-computed values
      const x = selectedCluster.centerX + selectedCluster.stdX * z1;
      const y = selectedCluster.centerY + 
                selectedCluster.stdY * (selectedCluster.correlation * z1 + selectedCluster.corrSqrt * z2);
      
      coords.push({ x, y });
    }
    
    return coords;
  }

  // Generate cell IDs
  const cellIds = Array.from({ length: cellsPerSample }, () =>
    rng.randomString(8) + '-1'
  );

  // Generate all spatial coordinates
  const allCoords = [];
  for (let i = 0; i < numSamples; i++) {
    const sampleCoords = generateSpatialCoordinates(i, cellsPerSample);
    for (let j = 0; j < sampleCoords.length; j++) {
      allCoords.push(sampleCoords[j]);
    }
  }

  // Generate cell data with spatial and sample-specific characteristics
  const cellRnaStats = {
    sample_id: [],
    total_counts: [],
    num_nonzero_vars: [],
    fraction_mitochondrial: [],
    fraction_ribosomal: [],
    cell_area: [],
    nucleus_ratio: [],
    x_coord: [],
    y_coord: [],
    cell_id: [],
    segmentation_method: [],
    region: []
  };

  for (let sampleIdx = 0; sampleIdx < numSamples; sampleIdx++) {
    const char = sampleCharacteristics[sampleIdx];
    const sampleRng = new Random(121 + sampleIdx * 150);
    const sampleCoords = allCoords.slice(sampleIdx * cellsPerSample, (sampleIdx + 1) * cellsPerSample);
    
    // Calculate coordinate ranges for this sample for spatial effects
    const xCoords = sampleCoords.map(c => c.x);
    const yCoords = sampleCoords.map(c => c.y);
    
    // Calculate min/max efficiently for large arrays
    let xMin = xCoords[0], xMax = xCoords[0];
    let yMin = yCoords[0], yMax = yCoords[0];
    for (let k = 1; k < xCoords.length; k++) {
      if (xCoords[k] < xMin) xMin = xCoords[k];
      if (xCoords[k] > xMax) xMax = xCoords[k];
      if (yCoords[k] < yMin) yMin = yCoords[k];
      if (yCoords[k] > yMax) yMax = yCoords[k];
    }
    const xRange = xMax - xMin, yRange = yMax - yMin;
    
    for (let cellIdx = 0; cellIdx < cellsPerSample; cellIdx++) {
      const coord = sampleCoords[cellIdx];
      
      // Determine cell type based on spatial position and sample characteristics
      const xNorm = xRange > 0 ? (coord.x - xMin) / xRange : 0.5;
      const yNorm = yRange > 0 ? (coord.y - yMin) / yRange : 0.5;
      
      // Spatial gradients determine cell type probabilities
      const distanceFromCenter = Math.sqrt((xNorm - 0.5) ** 2 + (yNorm - 0.5) ** 2);
      const isHighExpression = sampleRng.random() < char.expressionPattern.highExpression * (1 - distanceFromCenter);
      const isLowExpression = !isHighExpression && sampleRng.random() < char.expressionPattern.lowExpression;
      
      // Cell type multipliers for spatial data
      let typeMultiplier;
      if (isHighExpression) {
        typeMultiplier = { totalCounts: 1.8, mito: 0.6, ribo: 1.5, genes: 2.2, area: 1.3 };
      } else if (isLowExpression) {
        typeMultiplier = { totalCounts: 0.4, mito: 1.9, ribo: 0.7, genes: 0.5, area: 0.7 };
      } else {
        typeMultiplier = { totalCounts: 1.0, mito: 1.0, ribo: 1.0, genes: 1.0, area: 1.0 };
      }

      cellRnaStats.sample_id.push(`sample_${sampleIdx + 1}`);
      
      // Sample and spatially-specific total counts
      const baseCounts = sampleRng.randint(totalCountsRange[0], totalCountsRange[1]);
      cellRnaStats.total_counts.push(
        Math.round(baseCounts * char.totalCountMultiplier * typeMultiplier.totalCounts)
      );
      
      // Spatial data typically has fewer genes detected per cell
      const baseGenes = sampleRng.randint(nonzeroVarsRange[0], nonzeroVarsRange[1]);
      cellRnaStats.num_nonzero_vars.push(
        Math.max(1, Math.round(baseGenes * typeMultiplier.genes))
      );
      
      // Spatial effects on mitochondrial fraction
      const spatialMitoEffect = 1 + char.mitoGradientStrength * xNorm; // Gradient across x-axis
      cellRnaStats.fraction_mitochondrial.push(
        Math.max(0.001, Math.min(0.7,
          sampleRng.normal(char.expressionPattern.mitoBase * typeMultiplier.mito * spatialMitoEffect, mitoFractionSd)
        ))
      );
      
      // Spatial effects on ribosomal fraction (oscillating pattern)
      const spatialRiboEffect = 1 + 0.3 * Math.sin(yNorm * Math.PI * 2);
      cellRnaStats.fraction_ribosomal.push(
        Math.max(0.01, Math.min(0.6,
          sampleRng.normal(char.expressionPattern.riboBase * typeMultiplier.ribo * spatialRiboEffect, riboFractionSd)
        ))
      );
      
      // Cell morphology varies with cell type and position
      cellRnaStats.cell_area.push(
        sampleRng.uniform(cellAreaRange[0], cellAreaRange[1]) * typeMultiplier.area
      );
      
      cellRnaStats.nucleus_ratio.push(
        Math.max(0.05, Math.min(0.5,
          sampleRng.uniform(nucleusRatioRange[0], nucleusRatioRange[1]) * 
          (isHighExpression ? 1.2 : isLowExpression ? 0.8 : 1.0)
        ))
      );
      
      // Coordinates
      cellRnaStats.x_coord.push(coord.x);
      cellRnaStats.y_coord.push(coord.y);
      
      // Technical fields
      cellRnaStats.cell_id.push(cellIds[cellIdx]);
      cellRnaStats.segmentation_method.push('Segmented by nucleus expansion of 5.0µm');
      cellRnaStats.region.push('cell_labels');
    }
  }

  // Generate sample summary stats
  const sampleIds = Array.from({ length: numSamples }, (_, i) => `sample_${i + 1}`);
  const sampleSummaryStats = {
    sample_id: sampleIds,
    rna_num_barcodes: Array.from({ length: numSamples }, () => cellsPerSample * 2),
    rna_num_barcodes_filtered: Array.from({ length: numSamples }, () => cellsPerSample),
    rna_sum_total_counts: sampleIds.map(id =>
      getSampleStat(cellRnaStats.total_counts, id, arr => arr.reduce((a, b) => a + b, 0), cellRnaStats.sample_id)
    ),
    rna_median_total_counts: sampleIds.map(id =>
      getSampleStat(cellRnaStats.total_counts, id, arr => {
        const sorted = [...arr].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      }, cellRnaStats.sample_id)
    ),
    rna_overall_num_nonzero_vars: Array.from({ length: numSamples }, () =>
      Math.max(...nonzeroVarsRange) * 9
    ),
    rna_median_num_nonzero_vars: sampleIds.map(id =>
      getSampleStat(cellRnaStats.num_nonzero_vars, id, arr => {
        const sorted = [...arr].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      }, cellRnaStats.sample_id)
    ),
    control_probe_percentage: Array.from({ length: numSamples }, () => 0),
    negative_decoding_percentage: Array.from({ length: numSamples }, () => 0)
  };

  return {
    cell_rna_stats: transformDataFrame(cellRnaStats),
    sample_summary_stats: transformDataFrame(sampleSummaryStats)
  };
}

// Structure generators
function generateScStructure() {
  const cellrangerNames = [
    'Cells', 'Mean_reads_per_cell', 'Median_UMI_counts_per_cell',
    'Median_genes_per_cell', 'Sequencing_saturation', 'Fraction_reads_in_cells',
    'Total_genes_detected', 'Valid_barcodes'
  ];
  
  const cellRnaNames = [
    'total_counts', 'num_nonzero_vars', 'fraction_mitochondrial',
    'fraction_ribosomal', 'cellbender_background_fraction',
    'cellbender_cell_probability', 'cellbender_cell_size',
    'cellbender_droplet_efficiency'
  ];

  return {
    categories: [
      {
        name: 'Sample QC',
        key: 'sample_summary_stats',
        additionalAxes: false,
        defaultFilters: []
      },
      {
        name: 'SampleQC',
        key: 'metrics_cellranger_stats',
        additionalAxes: false,
        defaultFilters: cellrangerNames.map(name => ({
          type: 'bar',
          field: name,
          label: name.replace(/_/g, ' '),
          description: `Description for ${name}`,
          nBins: 10,
          groupBy: 'sample_id',
          xAxisType: 'linear',
          yAxisType: 'linear'
        }))
      },
      {
        name: 'Cell RNA QC',
        key: 'cell_rna_stats',
        additionalAxes: true,
        defaultFilters: cellRnaNames.map(name => ({
          type: 'histogram',
          field: name,
          label: name.replace(/_/g, ' '),
          description: `Description for ${name}`,
          cutoffMin: null,
          cutoffMax: null,
          zoomMax: null,
          nBins: 50,
          groupBy: 'sample_id',
          yAxisType: 'linear'
        }))
      }
    ]
  };
}

function generateXeniumStructure() {
  const colnames = [
    'total_counts', 'num_nonzero_vars', 'fraction_mitochondrial',
    'fraction_ribosomal', 'cell_area', 'nucleus_ratio'
  ];

  return {
    categories: [
      {
        name: 'Sample QC',
        key: 'sample_summary_stats',
        additionalAxes: false,
        defaultFilters: []
      },
      {
        name: 'Cell RNA QC',
        key: 'cell_rna_stats',
        additionalAxes: true,
        defaultFilters: colnames.map(col => ({
          type: 'histogram',
          visualizationType: 'histogram',
          field: col,
          label: col.replace(/_/g, ' '),
          description: `Description for ${col}`,
          cutoffMin: null,
          cutoffMax: null,
          zoomMax: null,
          nBins: 50,
          groupBy: 'sample_id',
          yAxisType: 'linear'
        }))
      }
    ]
  };
}

export {
  generateScDataset,
  generateXeniumDataset,
  generateScStructure,
  generateXeniumStructure,
  transformDataFrame,
  Random
};
