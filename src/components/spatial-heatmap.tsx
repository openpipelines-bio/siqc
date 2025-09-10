import { createMemo } from "solid-js";
import Plot from "@ralphsmith80/solid-plotly.js";
import { Layout, PlotData } from "plotly.js-dist-min";
import { plotlyConfig } from "~/lib/plots";

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
}

/**
 * Spatial heatmap with inline binning computation.
 * Supports both single and faceted layouts with per-sample optimization.
 */
// Helper function to create spatial bins from coordinates and values
function createSpatialBins(
  xCoords: number[], 
  yCoords: number[], 
  values: number[], 
  numBinsX: number, 
  numBinsY: number
): { xBinCenters: number[]; yBinCenters: number[]; zValues: (number | null)[][]; cellCounts: number[][] } {
  // Calculate bounds with small offset to avoid edge cases
  let xMin = xCoords[0], xMax = xCoords[0];
  let yMin = yCoords[0], yMax = yCoords[0];
  
  for (let i = 1; i < xCoords.length; i++) {
    if (xCoords[i] < xMin) xMin = xCoords[i];
    if (xCoords[i] > xMax) xMax = xCoords[i];
    if (yCoords[i] < yMin) yMin = yCoords[i];
    if (yCoords[i] > yMax) yMax = yCoords[i];
  }
  
  xMin -= 1e-6; xMax += 1e-6;
  yMin -= 1e-6; yMax += 1e-6;

  const xRange = xMax - xMin;
  const yRange = yMax - yMin;
  const aspectRatio = xRange / yRange;
  
  // Adjust bins to maintain square aspect ratio
  if (aspectRatio > 1) {
    numBinsY = Math.round(numBinsX / aspectRatio);
  } else {
    numBinsX = Math.round(numBinsY * aspectRatio);
  }

  const binWidthX = xRange / numBinsX;
  const binWidthY = yRange / numBinsY;

  // Create bin centers
  const xBinCenters = Array.from({ length: numBinsX }, (_, i) => xMin + (i + 0.5) * binWidthX);
  const yBinCenters = Array.from({ length: numBinsY }, (_, i) => yMin + (i + 0.5) * binWidthY);

  // Initialize 2D arrays
  const zValues: (number | null)[][] = Array.from({ length: numBinsY }, () => 
    Array.from({ length: numBinsX }, () => null)
  );
  const cellCounts: number[][] = Array.from({ length: numBinsY }, () => 
    Array.from({ length: numBinsX }, () => 0)
  );
  const binSums: number[][] = Array.from({ length: numBinsY }, () => 
    Array.from({ length: numBinsX }, () => 0)
  );

  // Accumulate values in bins
  for (let i = 0; i < xCoords.length; i++) {
    const value = values[i];
    if (value == null) continue;
    
    const xBin = Math.floor((xCoords[i] - xMin) / binWidthX);
    const yBin = Math.floor((yCoords[i] - yMin) / binWidthY);
    
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

  return { xBinCenters, yBinCenters, zValues, cellCounts };
}

export function SpatialHeatmap(props: SpatialHeatmapProps) {

  // Create single heatmap (no grouping)
  const createSingleHeatmap = (): Partial<PlotData>[] => {
    const numBinsX = props.numBinsX || 50;
    const numBinsY = props.numBinsY || 50;
    
    const { xBinCenters, yBinCenters, zValues, cellCounts } = createSpatialBins(
      props.xCoords, props.yCoords, props.values, numBinsX, numBinsY
    );

    return [{
      type: "heatmap",
      x: xBinCenters,
      y: yBinCenters,
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
  const createFacetedHeatmaps = (): Partial<PlotData>[] => {
    if (!props.groupIds) return [];

    const uniqueGroups = Array.from(new Set(props.groupIds)).sort();
    
    return uniqueGroups.map((group, idx) => {
      // Get coordinates and values for this group only
      const groupIndices = props.groupIds!.map((gId, i) => gId === group ? i : -1).filter(i => i >= 0);
      const groupXCoords = groupIndices.map(i => props.xCoords[i]);
      const groupYCoords = groupIndices.map(i => props.yCoords[i]);
      const groupValues = groupIndices.map(i => props.values[i]);
      
      if (groupXCoords.length === 0) return null;
      
      // Use the helper function for binning
      const numBinsX = props.numBinsX || 50;
      const numBinsY = props.numBinsY || 50;
      const { xBinCenters, yBinCenters, zValues, cellCounts } = createSpatialBins(
        groupXCoords, groupYCoords, groupValues, numBinsX, numBinsY
      );

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

  // Create plot data with inline binning
  const plotData = createMemo(() => {
    if (props.faceted && props.groupIds) {
      return createFacetedHeatmaps();
    }
    
    return createSingleHeatmap();
  });

  // Create single layout
  const createSingleLayout = (): Partial<Layout> => {
    // Calculate bounds
    let xMin = props.xCoords[0];
    let xMax = props.xCoords[0];
    let yMin = props.yCoords[0]; 
    let yMax = props.yCoords[0];
    
    for (let i = 1; i < props.xCoords.length; i++) {
      if (props.xCoords[i] < xMin) xMin = props.xCoords[i];
      if (props.xCoords[i] > xMax) xMax = props.xCoords[i];
      if (props.yCoords[i] < yMin) yMin = props.yCoords[i];
      if (props.yCoords[i] > yMax) yMax = props.yCoords[i];
    }
    
    const numBinsX = props.numBinsX || 50;
    const numBinsY = props.numBinsY || 50;
    
    return {
      title: {
        text: props.title,
        font: { size: 16 }
      },
      xaxis: {
        title: "X Coordinate",
        range: [xMin - 1e-6, xMax + 1e-6],
        scaleanchor: "y" as any,
        scaleratio: 1
      },
      yaxis: {
        title: "Y Coordinate", 
        range: [yMin - 1e-6, yMax + 1e-6]
      },
      margin: { l: 60, r: 60, t: 60, b: 60 },
      plot_bgcolor: 'rgba(240, 240, 240, 0.1)',
      annotations: [
        {
          x: 1,
          y: 1,
          xref: 'paper' as any,
          yref: 'paper' as any,
          text: `${props.xCoords.length.toLocaleString()} cells in ${numBinsX}×${numBinsY} grid`,
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
  const createFacetedLayout = (): Partial<Layout> => {
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
    if (props.faceted && props.groupIds) {
      return createFacetedLayout();
    }

    return createSingleLayout();
  });

  return (
    <div class="w-full">
      <Plot
        data={plotData()}
        layout={layout()}
        config={plotlyConfig()}
        style={{ width: "100%", height: props.height || "500px" }}
      />
    </div>
  );
}
