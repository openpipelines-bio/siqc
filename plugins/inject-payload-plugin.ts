import { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

interface PayloadPluginOptions {
  /** Path to the compressed payload file */
  payloadPath?: string;
  /** Path to the data JSON file for fallback generation */
  dataPath?: string;
  /** Path to the structure JSON file for fallback generation */
  structurePath?: string;
  /** Whether to generate payload if it doesn't exist */
  autoGenerate?: boolean;
}

/**
 * Vite plugin that injects compressed binary payload into HTML during build
 * This replaces the empty payload script tag with the actual compressed data
 */
export function injectPayloadPlugin(options: PayloadPluginOptions = {}): Plugin {
  const {
    payloadPath,
    dataPath,
    structurePath,
    autoGenerate = true
  } = options;

  return {
    name: 'inject-payload',
    enforce: 'post',
    
    async generateBundle(outputOptions, bundle) {
      // Find the HTML file in the bundle
      const htmlFile = Object.keys(bundle).find(name => name.endsWith('.html'));
      if (!htmlFile) return;

      const htmlAsset = bundle[htmlFile];
      if (htmlAsset.type !== 'asset' || typeof htmlAsset.source !== 'string') return;

      let payloadContent = '';
      
      try {
        // Try to read existing payload
        if (payloadPath && fs.existsSync(payloadPath)) {
          payloadContent = fs.readFileSync(payloadPath, 'utf8');
        } else if (autoGenerate && dataPath && structurePath && fs.existsSync(dataPath) && fs.existsSync(structurePath)) {
          // Generate payload if it doesn't exist
          const outputPayload = payloadPath || 'qc-report-payload.bin';
          await generatePayload(dataPath, structurePath, outputPayload);
          payloadContent = fs.readFileSync(outputPayload, 'utf8');
        } else {
          // Provide helpful error messages
          if (autoGenerate) {
            if (!dataPath) {
              console.error(`❌ No data path specified`);
              console.error('   Set QC_DATA_PATH environment variable or use the CLI');
            } else if (!fs.existsSync(dataPath)) {
              console.error(`❌ Data file not found: ${dataPath}`);
              console.error('   Set QC_DATA_PATH environment variable or use the CLI');
            }
            if (!structurePath) {
              console.error(`❌ No structure path specified`);
              console.error('   Set QC_STRUCTURE_PATH environment variable or use the CLI');
            } else if (!fs.existsSync(structurePath)) {
              console.error(`❌ Structure file not found: ${structurePath}`);
              console.error('   Set QC_STRUCTURE_PATH environment variable or use the CLI');
            }
          } else {
            if (!payloadPath) {
              console.error(`❌ No payload path specified and auto-generation is disabled`);
              console.error('   Set QC_PAYLOAD_PATH environment variable or use the CLI');
            } else {
              console.error(`❌ No payload found at ${payloadPath} and auto-generation is disabled`);
              console.error('   Set QC_PAYLOAD_PATH environment variable to point to an existing payload file');
            }
          }
          console.error('\n💡 Try: siqc --help');
          throw new Error('Missing required data files for payload generation');
        }

        // Inject the payload into the HTML
        const originalHtml = htmlAsset.source;
        const updatedHtml = originalHtml.replace(
          /<script id="payload" type="application\/octet-stream"><\/script>/,
          `<script id="payload" type="application/octet-stream">${payloadContent}</script>`
        );

        if (updatedHtml === originalHtml) {
          console.warn('⚠️  Could not find payload script tag to replace in HTML');
        } else {
          console.log(`✅ Injected ${Math.round(payloadContent.length / 1024)}KB payload into HTML`);
          htmlAsset.source = updatedHtml;
        }

      } catch (error) {
        console.error('❌ Failed to inject payload:', error);
        // Don't fail the build, just continue without payload
      }
    }
  };
}

/**
 * Generate compressed payload using the compress_data.js script
 */
async function generatePayload(dataPath: string, structurePath: string, outputPath: string): Promise<void> {
  const { execSync } = await import('child_process');
  
  try {
    execSync(`node scripts/compress_data.js "${dataPath}" "${outputPath}" "${structurePath}"`, {
      cwd: process.cwd(),
      stdio: 'pipe'
    });
    console.log(`✅ Generated payload: ${outputPath}`);
  } catch (error) {
    throw new Error(`Failed to generate payload: ${error}`);
  }
}
