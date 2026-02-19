import { ReportStructure, RawData, RawDataCategory, RawDataColumn } from "../types";
import { dataLoader } from "./data-loader";
import { TypedColumnData } from "./data-types";

/**
 * Convert progressive TypedColumnData to legacy RawDataColumn format
 */
function convertToLegacyColumn(typedColumn: TypedColumnData): RawDataColumn {
  // Convert typed arrays back to regular arrays for legacy compatibility
  const data = Array.from(typedColumn.data);
  
  console.log(`🔧 Converting column ${typedColumn.name}:`, 
    `${typedColumn.dtype} -> array of ${data.length} items`,
    `isArray: ${Array.isArray(data)}`,
    `sample: [${data.slice(0, 3).join(', ')}...]`);
  
  // Map data types
  let dtype: RawDataColumn['dtype'];
  switch (typedColumn.dtype) {
    case 'categorical':
      dtype = 'categorical';
      break;
    case 'int32':
      dtype = 'integer';
      break;
    case 'float32':
      dtype = 'numeric';
      break;
    default:
      dtype = 'numeric';
  }

  return {
    name: typedColumn.name,
    dtype,
    data,
    categories: typedColumn.categories
  };
}

/**
 * Convert progressive category data to legacy RawDataCategory format
 */
function convertToLegacyCategory(categoryData: { [columnName: string]: TypedColumnData }, categoryKey: string): RawDataCategory {
  const columns = Object.values(categoryData).map(convertToLegacyColumn);
  const firstColumn = Object.values(categoryData)[0];
  const numRows = firstColumn ? firstColumn.data.length : 0;
  
  return {
    num_rows: numRows,
    num_cols: columns.length,
    columns
  };
}

/**
 * Load data progressively from binary format
 */
async function getProgressiveData(): Promise<RawData> {
  if (!dataLoader.hasProgressiveData()) {
    throw new Error('Progressive data not available');
  }
  
  await dataLoader.init();
  const header = await dataLoader.getHeader();
  
  console.log('🔍 Progressive data header:', header);
  
  // Get all unique category keys
  const categoryKeys = [...new Set(header.columns.map(col => col.categoryKey))];
  console.log('🗂️ Loading categories:', categoryKeys);
  
  // Load all categories
  const result: RawData = {};
  for (const categoryKey of categoryKeys) {
    console.log(`📦 Loading category: ${categoryKey}`);
    const categoryData = await dataLoader.loadCategory(categoryKey);
    console.log(`📊 Raw category data for ${categoryKey}:`, Object.keys(categoryData), 'columns');
    
    result[categoryKey] = convertToLegacyCategory(categoryData, categoryKey);
    console.log(`✅ Converted ${categoryKey}:`, result[categoryKey].num_rows, 'rows,', result[categoryKey].num_cols, 'columns');
  }
  
  console.log('🎉 Final progressive data result:', Object.keys(result));
  return result;
}

/**
 * Load report structure progressively from binary format
 */
async function getProgressiveReportStructure(): Promise<ReportStructure> {
  if (!dataLoader.hasProgressiveData()) {
    throw new Error('Progressive data not available');
  }
  
  await dataLoader.init();
  const header = await dataLoader.getHeader();
  
  // Use structure from header if available
  if (header.categories) {
    const categories = Object.values(header.categories).map(cat => ({
      name: cat.name,
      key: cat.key as keyof RawData,
      description: cat.description,
      additionalAxes: cat.additionalAxes,
      embeddings: cat.embeddings,
      defaultFilters: cat.defaultFilters
    }));
    
    console.log(`📋 Loaded report structure with ${categories.length} categories:`, 
      categories.map(c => `${c.name} (${c.defaultFilters.length} filters)`).join(', '));
    
    return { categories };
  }
  
  // Fallback: Get all unique category keys and create default structure
  const categoryKeys = [...new Set(header.columns.map(col => col.categoryKey))];
  
  console.warn('⚠️ No categories in header, falling back to default structure');
  const categories = categoryKeys.map(key => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    key: key as keyof RawData,
    additionalAxes: true,
    defaultFilters: [] // Will be populated by the app based on available columns
  }));
  
  return { categories };
}

/**
 * Get data using progressive loading from binary format
 * Throws error if progressive data is not available
 */
export async function getData(): Promise<RawData> {
  return getProgressiveData();
}

/**
 * Get report structure using progressive loading from binary format
 * Throws error if progressive data is not available
 */
export async function getReportStructure(): Promise<ReportStructure> {
  return getProgressiveReportStructure();
}

/**
 * Initialize progressive data loader
 * Call this early in the app lifecycle
 */
export async function initializeDataLoader(): Promise<void> {
  if (dataLoader.hasProgressiveData()) {
    await dataLoader.init();
  }
}

/**
 * Access to the progressive data loader for components
 * that need fine-grained control over data loading
 */
export { dataLoader };
