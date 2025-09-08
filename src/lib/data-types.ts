/**
 * Header format for the compressed binary payload
 */
export interface DataHeader {
  formatVersion: number;
  rowCount: number;
  columns: ColumnInfo[];
  categories?: { [key: string]: CategoryInfo };
}

export interface CategoryInfo {
  name: string;
  key: string;
  additionalAxes: boolean;
  defaultFilters: FilterSettings[];
}

export interface ColumnInfo {
  name: string;
  categoryKey: string;
  dtype: 'int32' | 'float32' | 'categorical';
  offset: number;
  length: number;
  categories?: string[];
}

export interface FilterSettings {
  type: "histogram" | "bar" | "scatter";
  visualizationType?: "histogram" | "spatial";
  field: string;
  label?: string;
  yField?: string;
  yLabel?: string;
  description?: string;
  cutoffMin?: number;
  cutoffMax?: number;
  groupBy?: string;
}

/**
 * Worker message types for communication
 */
export interface WorkerMessage {
  type: 'loadHeader' | 'loadColumn' | 'loadCategory' | 'setPayload';
  columnName?: string;
  categoryKey?: string;
  payload?: string; // base64 encoded compressed data
}

export interface WorkerResponse {
  type: 'header' | 'columnData' | 'categoryData' | 'error';
  header?: DataHeader;
  columnName?: string;
  categoryKey?: string;
  data?: ArrayBuffer | { [columnName: string]: ArrayBuffer };
  error?: string;
}

/**
 * Typed column data structure
 */
export interface TypedColumnData {
  name: string;
  dtype: 'int32' | 'float32' | 'categorical';
  data: Int32Array | Float32Array;
  categories?: string[];
}
