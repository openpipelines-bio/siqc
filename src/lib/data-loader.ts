import { DataHeader, WorkerMessage, WorkerResponse, TypedColumnData } from './data-types';
import { markDataDecompressionStart, markDataDecompressionEnd, markDataParsingStart, markDataParsingEnd } from './performance-monitor';

/**
 * Progressive data loader that uses Web Workers for decompression
 * and provides a clean interface for components to request data
 */
export class DataLoader {
  private worker: Worker | null = null;
  private header: DataHeader | null = null;
  private columnCache = new Map<string, ArrayBuffer>();
  private categoryCache = new Map<string, { [columnName: string]: ArrayBuffer }>();
  private pendingRequests = new Map<string, Promise<any>>();

  /**
   * Initialize the worker and load the header
   */
  async init(): Promise<void> {
    if (this.header) {
      return; // Already initialized
    }

    console.log('🚀 Initializing data loader...');
    markDataDecompressionStart();

    // Create inline worker to avoid CORS issues with file:// URLs
    this.worker = await this.createInlineWorker();
    
    // Send payload to worker
    const payloadElement = document.getElementById('payload');
    const base64Data = payloadElement?.textContent?.trim() || '';
    
    if (!base64Data) {
      throw new Error('No payload found in HTML');
    }

    console.log(`📦 Payload size: ${(base64Data.length / 1024 / 1024).toFixed(2)}MB (base64)`);

    // Send payload to worker
    const payloadPromise = new Promise<void>((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'header') {
          this.worker!.removeEventListener('message', handleMessage);
          resolve();
        } else if (event.data.type === 'error') {
          this.worker!.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error));
        }
      };

      this.worker.addEventListener('message', handleMessage);
      this.worker.postMessage({ type: 'setPayload', payload: base64Data } as WorkerMessage);
    });

    await payloadPromise;
    
    // Request header
    const headerPromise = new Promise<DataHeader>((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'header' && event.data.header) {
          this.worker!.removeEventListener('message', handleMessage);
          resolve(event.data.header);
        } else if (event.data.type === 'error') {
          this.worker!.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error));
        }
      };

      this.worker.addEventListener('message', handleMessage);
      this.worker.postMessage({ type: 'loadHeader' } as WorkerMessage);
    });

    markDataParsingStart();
    this.header = await headerPromise;
    markDataParsingEnd();
    markDataDecompressionEnd();
    
    const categoryKeys = [...new Set(this.header.columns.map(col => col.categoryKey))];
    console.log(`✅ Data loader initialized. Categories: ${categoryKeys.join(', ')} (${this.header.columns.length} columns)`);
  }

  /**
   * Get the data header (must call init() first)
   */
  getHeader(): DataHeader {
    if (!this.header) {
      throw new Error('DataLoader not initialized. Call init() first.');
    }
    return this.header;
  }

  /**
   * Load a specific column of data
   */
  async loadColumn(columnName: string, categoryKey: string): Promise<TypedColumnData> {
    if (!this.worker || !this.header) {
      throw new Error('DataLoader not initialized. Call init() first.');
    }

    const cacheKey = `${categoryKey}:${columnName}`;
    
    // Check if already cached
    if (this.columnCache.has(cacheKey)) {
      const buffer = this.columnCache.get(cacheKey)!;
      return this.bufferToTypedColumn(buffer, columnName, categoryKey);
    }

    // Check if request is already pending
    if (this.pendingRequests.has(cacheKey)) {
      const buffer = await this.pendingRequests.get(cacheKey)!;
      return this.bufferToTypedColumn(buffer, columnName, categoryKey);
    }

    // Start new request
    const promise = new Promise<ArrayBuffer>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'columnData' && 
            event.data.columnName === columnName && 
            event.data.categoryKey === categoryKey &&
            event.data.data) {
          this.worker!.removeEventListener('message', handleMessage);
          resolve(event.data.data as ArrayBuffer);
        } else if (event.data.type === 'error' &&
            event.data.columnName === columnName &&
            event.data.categoryKey === categoryKey) {
          this.worker!.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error));
        }
      };

      this.worker!.addEventListener('message', handleMessage);
      this.worker!.postMessage({ 
        type: 'loadColumn', 
        columnName, 
        categoryKey 
      } as WorkerMessage);
    });

    this.pendingRequests.set(cacheKey, promise);

    try {
      const buffer = await promise;
      this.columnCache.set(cacheKey, buffer);
      this.pendingRequests.delete(cacheKey);
      return this.bufferToTypedColumn(buffer, columnName, categoryKey);
    } catch (error) {
      this.pendingRequests.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Load all columns for a category
   */
  async loadCategory(categoryKey: string): Promise<{ [columnName: string]: TypedColumnData }> {
    if (!this.worker || !this.header) {
      throw new Error('DataLoader not initialized. Call init() first.');
    }

    // Check if already cached
    if (this.categoryCache.has(categoryKey)) {
      const buffers = this.categoryCache.get(categoryKey)!;
      const result: { [columnName: string]: TypedColumnData } = {};
      
      for (const [columnName, buffer] of Object.entries(buffers)) {
        result[columnName] = this.bufferToTypedColumn(buffer, columnName, categoryKey);
      }
      
      return result;
    }

    // Check if request is already pending
    if (this.pendingRequests.has(categoryKey)) {
      const buffers = await this.pendingRequests.get(categoryKey)!;
      return this.buffersToTypedCategory(buffers, categoryKey);
    }

    // Start new request
    const promise = new Promise<{ [columnName: string]: ArrayBuffer }>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'categoryData' && 
            event.data.categoryKey === categoryKey &&
            event.data.data) {
          this.worker!.removeEventListener('message', handleMessage);
          resolve(event.data.data as { [columnName: string]: ArrayBuffer });
        } else if (event.data.type === 'error' &&
            event.data.categoryKey === categoryKey) {
          this.worker!.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error));
        }
      };

      this.worker!.addEventListener('message', handleMessage);
      this.worker!.postMessage({ 
        type: 'loadCategory', 
        categoryKey 
      } as WorkerMessage);
    });

    this.pendingRequests.set(categoryKey, promise);

    try {
      const buffers = await promise;
      this.categoryCache.set(categoryKey, buffers);
      this.pendingRequests.delete(categoryKey);
      return this.buffersToTypedCategory(buffers, categoryKey);
    } catch (error) {
      this.pendingRequests.delete(categoryKey);
      throw error;
    }
  }

  /**
   * Convert ArrayBuffer to TypedColumnData
   */
  private bufferToTypedColumn(buffer: ArrayBuffer, columnName: string, categoryKey: string): TypedColumnData {
    if (!this.header) {
      throw new Error('Header not loaded');
    }

    const column = this.header.columns.find(
      col => col.name === columnName && col.categoryKey === categoryKey
    );

    if (!column) {
      throw new Error(`Column ${columnName} not found in category ${categoryKey}`);
    }

    switch (column.dtype) {
      case 'int32':
      case 'categorical':
        return {
          name: columnName,
          dtype: column.dtype,
          data: new Int32Array(buffer),
          categories: column.categories
        };
      case 'float32':
        return {
          name: columnName,
          dtype: column.dtype,
          data: new Float32Array(buffer)
        };
      default:
        throw new Error(`Unsupported column type: ${column.dtype}`);
    }
  }

  /**
   * Convert multiple buffers to TypedColumnData objects
   */
  private buffersToTypedCategory(
    buffers: { [columnName: string]: ArrayBuffer }, 
    categoryKey: string
  ): { [columnName: string]: TypedColumnData } {
    const result: { [columnName: string]: TypedColumnData } = {};
    
    for (const [columnName, buffer] of Object.entries(buffers)) {
      result[columnName] = this.bufferToTypedColumn(buffer, columnName, categoryKey);
    }
    
    return result;
  }

  /**
   * Get available categories from header
   */
  getAvailableCategories(): string[] {
    if (!this.header) {
      throw new Error('DataLoader not initialized. Call init() first.');
    }

    return Array.from(new Set(this.header.columns.map(col => col.categoryKey)));
  }

  /**
   * Load multiple columns in parallel for better performance
   */
  async loadColumns(requests: Array<{columnName: string, categoryKey: string}>): Promise<TypedColumnData[]> {
    // Load all columns in parallel
    const promises = requests.map(req => this.loadColumn(req.columnName, req.categoryKey));
    return Promise.all(promises);
  }

  /**
   * Preload commonly used columns to reduce initial load times
   */
  async preloadCommonColumns(): Promise<void> {
    if (!this.header) return;

    const commonColumns = ['sample_id', 'total_counts', 'num_nonzero_vars'];
    const preloadPromises: Promise<any>[] = [];

    // Find which columns to preload
    for (const column of this.header.columns) {
      if (commonColumns.includes(column.name)) {
        console.log(`🔄 Preloading ${column.name} from ${column.categoryKey}`);
        preloadPromises.push(this.loadColumn(column.name, column.categoryKey));
      }
    }

    await Promise.all(preloadPromises);
    console.log('✅ Common columns preloaded');
  }

  /**
   * Get available columns for a category
   */
  getAvailableColumns(categoryKey: string): string[] {
    if (!this.header) {
      throw new Error('DataLoader not initialized. Call init() first.');
    }

    return this.header.columns
      .filter(col => col.categoryKey === categoryKey)
      .map(col => col.name);
  }

  /**
   * Check if data is in new binary format
   */
  hasProgressiveData(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }
    
    const payloadElement = document.getElementById('payload');
    return !!(payloadElement?.textContent?.trim());
  }

  /**
   * Create an inline worker to avoid CORS issues with file:// URLs
   * This embeds the worker code as a blob to make the HTML truly standalone
   */
  private async createInlineWorker(): Promise<Worker> {
    // Inline worker code to avoid CORS issues with file:// URLs
    const workerCode = `
// Data types for worker communication
const cache = {
  header: null,
  buffer: null,
  payload: null
};

async function loadPayload(base64Data) {
  if (cache.buffer) {
    return cache.buffer;
  }

  try {
    if (!base64Data) {
      throw new Error('No payload data provided');
    }

    // Decode base64 to Uint8Array
    const binaryString = atob(base64Data);
    const compressedData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      compressedData[i] = binaryString.charCodeAt(i);
    }

    // Check if DecompressionStream is available (modern browsers)
    if (typeof DecompressionStream !== 'undefined') {
      // Use native DecompressionStream for better performance
      const decompressStream = new DecompressionStream('gzip');
      const reader = decompressStream.readable.getReader();
      const writer = decompressStream.writable.getWriter();
      
      writer.write(compressedData);
      writer.close();
      
      const chunks = [];
      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }
      
      // Combine chunks into single buffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      
      cache.buffer = combined.buffer;
      cache.payload = base64Data;
      
      return cache.buffer;
    } else {
      throw new Error('DecompressionStream not supported in this browser');
    }
  } catch (error) {
    throw new Error('Failed to decompress payload: ' + error.message);
  }
}

function loadHeader(buffer) {
  try {
    // Parse JSON header format (not binary)
    const view = new DataView(buffer);
    const headerLength = view.getUint32(0, true); // little-endian
    const headerBytes = new Uint8Array(buffer, 4, headerLength);
    const headerJson = new TextDecoder().decode(headerBytes);
    
    return JSON.parse(headerJson);
  } catch (error) {
    throw new Error('Failed to parse header: ' + error.message);
  }
}

function extractColumn(buffer, columnInfo) {
  try {
    // Calculate aligned data start offset (matching original worker)
    const headerLength = new DataView(buffer).getUint32(0, true);
    const dataStart = 4 + headerLength;
    const alignment = 4;
    const padding = (alignment - (dataStart % alignment)) % alignment;
    const alignedDataStart = dataStart + padding;
    
    // Column offset is relative to aligned data start
    const absoluteOffset = alignedDataStart + columnInfo.offset;
    
    let typedArray;
    
    switch (columnInfo.dtype) {
      case 'int32':
      case 'categorical':
        // Create a copy of the data to transfer
        const int32Data = new Int32Array(buffer, absoluteOffset, columnInfo.length);
        typedArray = new Int32Array(int32Data).buffer;
        break;
      case 'float32':
        // Create a copy of the data to transfer
        const float32Data = new Float32Array(buffer, absoluteOffset, columnInfo.length);
        typedArray = new Float32Array(float32Data).buffer;
        break;
      default:
        throw new Error('Unsupported column type: ' + columnInfo.dtype);
    }
    
    return typedArray;
  } catch (error) {
    throw new Error('Failed to extract column: ' + error.message);
  }
}

// Worker message handler
self.addEventListener('message', async (event) => {
  const { type, columnName, categoryKey, payload } = event.data;
  
  try {
    if (type === 'setPayload') {
      console.log('🔧 Worker: Loading payload...');
      cache.payload = payload;
      const buffer = await loadPayload(payload);
      const header = loadHeader(buffer);
      cache.header = header;
      
      self.postMessage({
        type: 'header',
        header: header
      });
    } else if (type === 'loadHeader') {
      // Load and parse header
      if (!cache.payload) {
        throw new Error('No payload set. Call setPayload first.');
      }
      const buffer = await loadPayload(cache.payload);
      const header = loadHeader(buffer);
      
      self.postMessage({
        type: 'header',
        header: header
      });
    } else if (type === 'loadColumn') {
      if (!cache.payload) {
        throw new Error('No payload set. Call setPayload first.');
      }
      
      const buffer = await loadPayload(cache.payload);
      const header = loadHeader(buffer);
      
      const columnInfo = header.columns.find(col => col.name === columnName && col.categoryKey === categoryKey);
      if (!columnInfo) {
        throw new Error('Column not found: ' + columnName + ' in category ' + categoryKey);
      }
      
      const data = extractColumn(buffer, columnInfo);
      
      self.postMessage({
        type: 'columnData',
        columnName: columnName,
        categoryKey: categoryKey,
        data: data
      }, [data]);
    } else if (type === 'loadCategory') {
      if (!cache.payload) {
        throw new Error('No payload set. Call setPayload first.');
      }
      
      const buffer = await loadPayload(cache.payload);
      const header = loadHeader(buffer);
      
      const categoryColumns = header.columns.filter(col => col.categoryKey === categoryKey);
      if (categoryColumns.length === 0) {
        throw new Error('Category not found: ' + categoryKey);
      }
      
      const result = {};
      const transfers = [];
      
      for (const columnInfo of categoryColumns) {
        const data = extractColumn(buffer, columnInfo);
        result[columnInfo.name] = data;
        transfers.push(data);
      }
      
      self.postMessage({
        type: 'categoryData',
        categoryKey: categoryKey,
        data: result
      }, transfers);
    } else {
      throw new Error('Unknown message type: ' + type);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      columnName: columnName,
      categoryKey: categoryKey,
      error: error.message
    });
  }
});
`;
    
    // Create a blob URL for the worker
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    
    return new Worker(workerUrl);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.header = null;
    this.columnCache.clear();
    this.categoryCache.clear();
    this.pendingRequests.clear();
  }
}

// Singleton instance for the app
export const dataLoader = new DataLoader();
