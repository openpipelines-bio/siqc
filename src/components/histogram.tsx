import Plot from "@ralphsmith80/solid-plotly.js";
import _ from "lodash";
import { Layout, PlotData } from "plotly.js-dist-min";
import { cutoffShape, plotlyConfig, recurringColours, createAxisAnnotation } from "~/lib/plots";
import { calculateBinCounts, createBinLabels } from "~/lib/histogram-utils";
import { FilterSettings, RawDataCategory } from "~/types";

/**
 * Compute reasonable auto-zoom range for histogram data
 * Excludes extreme outliers to get a better view of the main data distribution
 */
function computeAutoZoomRange(values: number[], globalMin: number, globalMax: number) {
  if (values.length === 0) {
    return { min: globalMin, max: globalMax };
  }
  
  // Sort values to compute percentiles
  const sortedValues = [...values].sort((a, b) => a - b);
  const n = sortedValues.length;
  
  // Use 1st and 99th percentiles to exclude extreme outliers
  const p1Index = Math.floor(n * 0.01);
  const p99Index = Math.floor(n * 0.99);
  
  const p1 = sortedValues[p1Index] || globalMin;
  const p99 = sortedValues[p99Index] || globalMax;
  
  // Add some padding (5% on each side)
  const range = p99 - p1;
  const padding = range * 0.05;
  
  const autoMin = Math.max(globalMin, p1 - padding);
  const autoMax = Math.min(globalMax, p99 + padding);
  
  return { min: autoMin, max: autoMax };
}

type Props = {
  data: RawDataCategory;
  filterSettings: FilterSettings;
  additionalAxes: boolean;
};

function histogramData(props: {
  data: RawDataCategory;
  valueName: string;
  numBins: number;
  groupName?: string;
  zoomMin?: number;
  zoomMax?: number;
  additionalAxes?: boolean;
}): Partial<PlotData>[] {
  const column = props.data.columns.find(c => c.name === props.valueName);
  if (!column) return [];

  const groupColumn = props.groupName
    ? props.data.columns.find(c => c.name === props.groupName)
    : undefined;
  if (props.groupName && !groupColumn) return [];

  const values = column.data as number[];
  const groupValues = groupColumn ? groupColumn.data as number[] : undefined;

  const globalMin = _.min(values)!;
  const globalMax = _.max(values)!;
  
  // Auto-compute reasonable zoom range if not specified or if values are null
  const autoZoomRange = computeAutoZoomRange(values, globalMin, globalMax);
  const actualMin = (props.zoomMin !== undefined && props.zoomMin !== null) ? props.zoomMin : autoZoomRange.min;
  const actualMax = (props.zoomMax !== undefined && props.zoomMax !== null) ? props.zoomMax : autoZoomRange.max;
  
  // Auto-compute reasonable number of bins if too many or too few
  const dataRange = actualMax - actualMin;
  const autoBins = Math.min(Math.max(Math.ceil(Math.sqrt(values.length)), 20), 100);
  const effectiveNumBins = (props.numBins < 10 || props.numBins > 200) ? autoBins : props.numBins;
  
  const binSize = (actualMax - actualMin) / effectiveNumBins;

  const { binCounts, groupCounts } = calculateBinCounts(
    values, actualMin, actualMax, effectiveNumBins, groupValues
  );

  const roundingBase = Math.floor(Math.log10(binSize));
  const roundFun = (v: number) => v.toFixed(_.clamp(-roundingBase, 0, 15));
  const x0 = binCounts.map((_, i) => actualMin + binSize * (i - 1));
  const x1 = binCounts.map((_, i) => actualMin + binSize * i);
  const x = x0.map((start, i) => (start + x1[i]) / 2);
  
  const binLabels = createBinLabels(
    binCounts, x0, x1, roundFun, globalMin, globalMax, effectiveNumBins
  );

  const plotOverall = (props.additionalAxes && props.groupName !== undefined) ||
                     (!props.additionalAxes && props.groupName === undefined);

  const overall: Partial<PlotData>[] = plotOverall
    ? [{
        type: "bar" as const,
        x: x,
        y: binCounts,
        marker: { color: recurringColours.pass },
        hovertext: binLabels,
        hoverinfo: "text",
        name: "Overall",
        xaxis: "x",
        yaxis: "y",
      }]
    : [];

  const perGroup: Partial<PlotData>[] = groupCounts 
    ? groupCounts.map((counts, i) => {
        const groupLabels = createBinLabels(
          counts, x0, x1, roundFun, globalMin, globalMax, props.numBins
        );
        
        return {
          type: "bar" as const,
          x: x,
          y: counts,
          name: groupColumn?.categories![i],
          hovertext: groupLabels,
          hoverinfo: "text",
          xaxis: "x",
          yaxis: props.additionalAxes ? `y${i + 2}` : "y",
        };
      })
    : [];

  return overall.concat(perGroup);
}

function histogramLayout(props: {
  data: RawDataCategory;
  xTitle: string;
  minCutoff?: number;
  maxCutoff?: number;
  groupName?: string;
  additionalAxes: boolean;
  xType: "log" | "linear";
  yType: "log" | "linear";
}): Partial<Layout> {
  let height = 200;
  const annotations: Partial<Layout["annotations"][0]>[] = [];
  let sampleYAxes: { [key: string]: Partial<Layout["yaxis"]> } = {};
  let grid: Partial<Layout["grid"]> = {};
  let plotHeight = 1.0;

  const groupColumn = props.groupName
    ? props.data.columns.find(c => c.name === props.groupName)
    : undefined;
    
  if (groupColumn && props.additionalAxes) {
    const actualValues = groupColumn.data as number[];
    const uniqueIndices = Array.from(new Set(actualValues)).sort((a, b) => a - b);
    
    const groupNames = groupColumn.categories 
      ? uniqueIndices.map(idx => groupColumn.categories![idx])
      : uniqueIndices.map(v => `Sample ${v}`);
      
    console.log("Using filtered group names:", groupNames);
    
    const totalPlots = groupNames.length + 1;
    plotHeight = 1.0 / totalPlots;
    
    groupNames.forEach((label, i) => {
      const plotIndex = i + 1;
      const midPoint = 1.0 - (plotIndex * plotHeight + plotHeight/2);
      annotations.push(createAxisAnnotation(label, midPoint));
    });
    
    sampleYAxes = Object.fromEntries(
      groupNames.map((_, i) => {
        return [`yaxis${i + 2}`, {
          side: "left" as const,
          fixedrange: true,
          type: props.yType,
          automargin: true,
          showticklabels: true,
        }];
      })
    );
    
    // Configure subplot grid
    
    grid = {
      columns: 1,
      rows: groupNames.length + 1,
      subplots: ["xy"].concat(groupNames.map((_, i) => `xy${i + 2}`)),
    };
    
    height = Math.max(200, 75 * (groupNames.length + 1));
  }

  annotations.push(createAxisAnnotation("Total", 1.0 - plotHeight/2));

  return {
    xaxis: {
      title: props.xTitle,
      type: props.xType,
      fixedrange: true,
      automargin: true,
      titlefont: { size: 14 },
    },
    yaxis: {
      side: "left" as const,
      fixedrange: true,
      type: props.yType,
      automargin: true,
      showticklabels: true,
    },
    ...sampleYAxes,
    annotations,
    shapes: cutoffShape("Min", props.minCutoff).concat(
      cutoffShape("Max", props.maxCutoff),
    ),
    showlegend: false,
    height,
    barmode: "stack",
    grid,
    margin: {
      b: 60,
      t: 20,
      l: 175,
      r: 10,
      pad: 4,
    },
  };
}

export function Histogram(props: Props) {
  return (
    <Plot
      data={histogramData({
        data: props.data,
        valueName: props.filterSettings.field,
        groupName: props.filterSettings.groupBy,
        numBins: props.filterSettings.nBins || 50, // Add default value of 50
        zoomMin: props.filterSettings.zoomMin,
        zoomMax: props.filterSettings.zoomMax,
        additionalAxes: props.additionalAxes,
      })}
      layout={histogramLayout({
        data: props.data,
        groupName: props.filterSettings.groupBy,
        xTitle: props.filterSettings.label || props.filterSettings.field, // Use field name as fallback
        minCutoff: props.filterSettings.cutoffMin,
        maxCutoff: props.filterSettings.cutoffMax,
        xType: props.filterSettings.xAxisType || "linear",
        yType: props.filterSettings.yAxisType || "linear",
        additionalAxes: props.additionalAxes,
      })}
      config={plotlyConfig()}
      useResizeHandler={true}
    />
  );
}