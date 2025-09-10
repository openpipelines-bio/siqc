import { createMemo, createSignal, onMount } from "solid-js";
import Plot from "@ralphsmith80/solid-plotly.js";
import { Layout, PlotData } from "plotly.js-dist-min";
import { plotlyConfig } from "~/lib/plots";
import * as _ from "lodash";

export interface SpatialBinData {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  numBinsX: number;
  numBinsY: number;
  binWidthX: number;
  binWidthY: number;
  xBinCenters: number[];
  yBinCenters: number[];
  binIndices: number[][][]; // [yBin][xBin][cellIndices]
}

export interface SpatialHeatmapProps {
  xCoords: number[];
  yCoords: number[];
  values: number[];
  groupIds?: number[] | null;
  groupLabels?: string[] | null;
  title: string;
  colorField: string;
  faceted?: boolean;
  height?: string;
  numBinsX?: number;
  numBinsY?: number;
  precomputedBins?: SpatialBinData;
}

/**
 * Efficient spatial heatmap that pre-computes grid binning once and reuses it.
 * Optimized for millions of cells across multiple grouped heatmaps.
 */
export function SpatialHeatmap(props: SpatialHeatmapProps) {
  const [binData, setBinData] = createSignal<SpatialBinData>();
  const [isProcessing, setIsProcessing] = createSignal(false);

  // Reactive computation of bins - updates when props change
  const computeBins = createMemo(() => {
    if (props.precomputedBins) {
      // Use precomputed bins immediately
      setBinData(props.precomputedBins);
      console.log(`✅ Using precomputed spatial bins (${props.precomputedBins.numBinsX}×${props.precomputedBins.numBinsY})`);
      return props.precomputedBins;
    }
    // Fallback: compute bins ourselves
    setIsProcessing(true);
    
    try {
      const xCoords = props.xCoords;
      const yCoords = props.yCoords;
      const numBinsX = props.numBinsX || 50;
      const numBinsY = props.numBinsY || 50;

      // Calculate bounds with small offset to avoid edge cases
      // Use manual min/max calculation to avoid "too many arguments" error with large arrays
      let xMin = xCoords[0];
      let xMax = xCoords[0];
      let yMin = yCoords[0];
      let yMax = yCoords[0];
      
      for (let i = 1; i < xCoords.length; i++) {
        if (xCoords[i] < xMin) xMin = xCoords[i];
        if (xCoords[i] > xMax) xMax = xCoords[i];
        if (yCoords[i] < yMin) yMin = yCoords[i];
        if (yCoords[i] > yMax) yMax = yCoords[i];
      }
      
      xMin -= 1e-6;
      xMax += 1e-6;
      yMin -= 1e-6;
      yMax += 1e-6;

      const binWidthX = (xMax - xMin) / numBinsX;
      const binWidthY = (yMax - yMin) / numBinsY;

      // Create bin centers
      const xBinCenters = Array.from({ length: numBinsX }, (_, i) => 
        xMin + (i + 0.5) * binWidthX
      );
      const yBinCenters = Array.from({ length: numBinsY }, (_, i) => 
        yMin + (i + 0.5) * binWidthY
      );

      // Initialize 2D array for bin indices
      const binIndices: number[][][] = Array.from({ length: numBinsY }, () => 
        Array.from({ length: numBinsX }, () => [])
      );

      // Assign each cell to its bin (this is the expensive operation we do once)
      for (let i = 0; i < xCoords.length; i++) {
        const px = xCoords[i];
        const py = yCoords[i];

        // Find bin indices
        const xBin = Math.floor((px - xMin) / binWidthX);
        const yBin = Math.floor((py - yMin) / binWidthY);
        
        // Ensure we're within bounds
        if (xBin >= 0 && xBin < numBinsX && yBin >= 0 && yBin < numBinsY) {
          binIndices[yBin][xBin].push(i);
        }
      }

      const result = {
        xMin,
        xMax,
        yMin,
        yMax,
        numBinsX,
        numBinsY,
        binWidthX,
        binWidthY,
        xBinCenters,
        yBinCenters,
        binIndices
      };
      
      setBinData(result);
      setIsProcessing(false);
      return result;

    } catch (error) {
      console.error('❌ Spatial binning failed:', error);
      setIsProcessing(false);
      return undefined;
    }
  });

  // Trigger computation whenever dependencies change
  onMount(() => computeBins());

  // Create single heatmap (no grouping)
  const createSingleHeatmap = (bins: SpatialBinData): Partial<PlotData>[] => {
    // Calculate average value for each bin
    const zValues = bins.binIndices.map(row =>
      row.map(cellIndices => {
        if (cellIndices.length === 0) return null;
        const values = cellIndices.map(i => props.values[i]).filter(v => v != null);
        if (values.length === 0) return null;
        
        // Manual mean calculation to avoid "too many arguments" error
        let sum = 0;
        for (let i = 0; i < values.length; i++) {
          sum += values[i];
        }
        return sum / values.length;
      })
    );

    // Calculate cell counts for hover info
    const cellCounts = bins.binIndices.map(row =>
      row.map(cellIndices => cellIndices.length)
    );

    return [{
      type: "heatmap",
      x: bins.xBinCenters,
      y: bins.yBinCenters,
      z: zValues,
      colorscale: [
        [0, 'rgba(240, 240, 240, 0.4)'],
        [0.1, 'rgba(240, 249, 255, 0.6)'],
        [0.3, 'rgba(204, 224, 255, 0.8)'],
        [0.5, 'rgba(102, 169, 255, 0.9)'],
        [0.7, 'rgba(51, 119, 255, 0.95)'],
        [1.0, 'rgba(0, 68, 204, 1)']
      ],
      hoverongaps: false,
      customdata: cellCounts,
      hovertemplate: 
        `<b>${props.colorField}</b>: %{z:.3f}<br>` +
        '<b>Cells in bin</b>: %{customdata}<br>' +
        '<b>X</b>: %{x:.2f}<br>' +
        '<b>Y</b>: %{y:.2f}<br>' +
        '<extra></extra>',
      colorbar: {
        title: props.colorField,
        titleside: "right"
      },
      showlegend: false
    }];
  };

  // Create faceted heatmaps with per-sample binning
  const createFacetedHeatmaps = (_bins: SpatialBinData): Partial<PlotData>[] => {
    if (!props.groupIds) return [];

    const uniqueGroups = Array.from(new Set(props.groupIds)).sort();
    
    return uniqueGroups.map((group, idx) => {
      // Get coordinates and values for this group only
      const groupIndices = props.groupIds!.map((gId, i) => gId === group ? i : -1).filter(i => i >= 0);
      const groupXCoords = groupIndices.map(i => props.xCoords[i]);
      const groupYCoords = groupIndices.map(i => props.yCoords[i]);
      const groupValues = groupIndices.map(i => props.values[i]);
      
      if (groupXCoords.length === 0) return null;
      
      // Compute separate bins for this group to maintain square aspect ratio
      // Use manual min/max calculation to avoid "too many arguments" error with large arrays
      let xMin = groupXCoords[0];
      let xMax = groupXCoords[0];
      let yMin = groupYCoords[0];
      let yMax = groupYCoords[0];
      
      for (let i = 1; i < groupXCoords.length; i++) {
        if (groupXCoords[i] < xMin) xMin = groupXCoords[i];
        if (groupXCoords[i] > xMax) xMax = groupXCoords[i];
        if (groupYCoords[i] < yMin) yMin = groupYCoords[i];
        if (groupYCoords[i] > yMax) yMax = groupYCoords[i];
      }
      
      xMin -= 1e-6;
      xMax += 1e-6;
      yMin -= 1e-6;
      yMax += 1e-6;
      
      const xRange = xMax - xMin;
      const yRange = yMax - yMin;
      const aspectRatio = xRange / yRange;
      
      // Calculate bins to maintain square aspect ratio
      let numBinsX = props.numBinsX || 50;
      let numBinsY = props.numBinsY || 50;
      
      if (aspectRatio > 1) {
        numBinsY = Math.round(numBinsX / aspectRatio);
      } else {
        numBinsX = Math.round(numBinsY * aspectRatio);
      }
      
      const binWidthX = xRange / numBinsX;
      const binWidthY = yRange / numBinsY;
      
      // Create bin centers
      const xBinCenters = Array.from({ length: numBinsX }, (_, i) => 
        xMin + (i + 0.5) * binWidthX
      );
      const yBinCenters = Array.from({ length: numBinsY }, (_, i) => 
        yMin + (i + 0.5) * binWidthY
      );
      
      // Initialize 2D arrays for values and counts
      const zValues: (number | null)[][] = Array.from({ length: numBinsY }, () => 
        Array.from({ length: numBinsX }, () => null)
      );
      const cellCounts: number[][] = Array.from({ length: numBinsY }, () => 
        Array.from({ length: numBinsX }, () => 0)
      );
      
      // Accumulate values in bins
      const binSums: number[][] = Array.from({ length: numBinsY }, () => 
        Array.from({ length: numBinsX }, () => 0)
      );
      
      for (let i = 0; i < groupXCoords.length; i++) {
        const px = groupXCoords[i];
        const py = groupYCoords[i];
        const value = groupValues[i];
        
        if (value == null) continue;
        
        // Find bin indices
        const xBin = Math.floor((px - xMin) / binWidthX);
        const yBin = Math.floor((py - yMin) / binWidthY);
        
        // Ensure we're within bounds
        if (xBin >= 0 && xBin < numBinsX && yBin >= 0 && yBin < numBinsY) {
          binSums[yBin][xBin] += value;
          cellCounts[yBin][xBin]++;
        }
      }
      
      // Calculate averages
      for (let yBin = 0; yBin < numBinsY; yBin++) {
        for (let xBin = 0; xBin < numBinsX; xBin++) {
          if (cellCounts[yBin][xBin] > 0) {
            zValues[yBin][xBin] = binSums[yBin][xBin] / cellCounts[yBin][xBin];
          }
        }
      }

      return {
        type: "heatmap" as const,
        x: xBinCenters,
        y: yBinCenters,
        z: zValues,
        colorscale: 'Viridis',
        hoverongaps: false,
        customdata: cellCounts,
        hovertemplate: 
          `<b>${props.groupLabels && props.groupLabels[group] ? props.groupLabels[group] : `Sample ${group + 1}`}</b><br>` +
          `<b>${props.colorField}</b>: %{z:.3f}<br>` +
          '<b>Cells in bin</b>: %{customdata}<br>' +
          '<b>X</b>: %{x:.2f}<br>' +
          '<b>Y</b>: %{y:.2f}<br>' +
          '<extra></extra>',
        showscale: idx === 0, // Only show colorbar for first trace
        colorbar: idx === 0 ? {
          title: props.colorField,
          x: 1.02
        } : undefined,
        name: `Group ${group}`,
        xaxis: `x${idx + 1}`,
        yaxis: `y${idx + 1}`
      };
    }).filter(Boolean) as Partial<PlotData>[];
  };

  // Create plot data from the pre-computed bins
  const plotData = createMemo(() => {
    const bins = binData();
    if (!bins) return [];

    if (props.faceted && props.groupIds) {
      return createFacetedHeatmaps(bins);
    }
    
    return createSingleHeatmap(bins);
  });

  // Create single layout
  const createSingleLayout = (bins: SpatialBinData): Partial<Layout> => {
    return {
      title: {
        text: props.title,
        font: { size: 16 }
      },
      xaxis: {
        title: "X Coordinate",
        range: [bins.xMin, bins.xMax],
        scaleanchor: "y" as any,
        scaleratio: 1
      },
      yaxis: {
        title: "Y Coordinate", 
        range: [bins.yMin, bins.yMax]
      },
      margin: { l: 60, r: 60, t: 60, b: 60 },
      plot_bgcolor: 'rgba(240, 240, 240, 0.1)',
      annotations: [
        {
          x: 1,
          y: 1,
          xref: 'paper' as any,
          yref: 'paper' as any,
          text: `${props.xCoords.length.toLocaleString()} cells in ${bins.numBinsX}×${bins.numBinsY} grid`,
          showarrow: false,
          xanchor: 'right' as any,
          yanchor: 'top' as any,
          font: { size: 10, color: 'gray' },
          bgcolor: 'rgba(255, 255, 255, 0.8)',
          bordercolor: 'gray',
          borderwidth: 1
        }
      ] as any
    };
  };

  // Create faceted layout
  const createFacetedLayout = (bins: SpatialBinData): Partial<Layout> => {
    if (!props.groupIds) return {};

    const uniqueGroups = Array.from(new Set(props.groupIds)).sort();
    const numGroups = uniqueGroups.length;
    const cols = Math.ceil(Math.sqrt(numGroups));
    const rows = Math.ceil(numGroups / cols);

    // Calculate subplot dimensions - let width be responsive
    const baseHeight = 250; // Base height per subplot row
    const totalHeight = rows * baseHeight;

    const layout: any = {
      title: props.title,
      showlegend: false,
      width: undefined, // Let width be responsive to container
      height: Math.max(400, totalHeight),
      grid: {
        rows: rows,
        columns: cols,
        pattern: 'independent'
      }
    };

    // Configure each subplot
    uniqueGroups.forEach((group, idx) => {
      const axisNum = idx + 1;
      const xAxisKey = axisNum === 1 ? 'xaxis' : `xaxis${axisNum}`;
      const yAxisKey = axisNum === 1 ? 'yaxis' : `yaxis${axisNum}`;

      layout[xAxisKey] = {
        title: idx >= numGroups - cols ? 'X Coordinate' : '',
        // No range setting - let each subplot auto-scale to its data for sample-specific scaling
        showgrid: true,
        zeroline: false,
        scaleanchor: axisNum === 1 ? "y" : `y${axisNum}`,
        scaleratio: 1
      };
      layout[yAxisKey] = {
        title: idx % cols === 0 ? 'Y Coordinate' : '',
        // No range setting - let each subplot auto-scale to its data for sample-specific scaling
        showgrid: true,
        zeroline: false
      };

      // Add group title as annotation with proper sample name
      const groupLabel = props.groupLabels && props.groupLabels[group] 
        ? props.groupLabels[group] 
        : `Sample ${group + 1}`;
        
      if (!layout.annotations) layout.annotations = [];
      layout.annotations.push({
        text: `<b>${groupLabel}</b>`,
        showarrow: false,
        x: 0.5,
        y: 1.02,
        xref: axisNum === 1 ? 'x domain' : `x${axisNum} domain`,
        yref: axisNum === 1 ? 'y domain' : `y${axisNum} domain`,
        font: { size: 12 }
      });
    });

    return layout;
  };

  // Create layout
  const layout = createMemo((): Partial<Layout> => {
    const bins = binData();
    if (!bins) return {};

    if (props.faceted && props.groupIds) {
      return createFacetedLayout(bins);
    }

    return createSingleLayout(bins);
  });

  return (
    <div class="w-full">
      {isProcessing() ? (
        <div class="flex items-center justify-center h-96 bg-gray-50 rounded">
          <div class="text-center">
            <div class="animate-spin text-2xl mb-2">🔄</div>
            <div class="text-gray-600">Computing spatial bins...</div>
            <div class="text-xs text-gray-500 mt-1">
              Processing {props.xCoords.length.toLocaleString()} cells
            </div>
          </div>
        </div>
      ) : binData() ? (
        <Plot
          data={plotData()}
          layout={layout()}
          config={plotlyConfig()}
          style={{ width: "100%", height: props.height || "500px" }}
        />
      ) : (
        <div class="flex items-center justify-center h-96 bg-red-50 rounded border border-red-200">
          <div class="text-center text-red-600">
            <div class="text-xl mb-2">⚠️</div>
            <div>Failed to compute spatial bins</div>
          </div>
        </div>
      )}
    </div>
  );
}
