import path from "path";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { viteSingleFile } from "vite-plugin-singlefile";
import { injectPayloadPlugin } from "./plugins/inject-payload-plugin";
import { config } from "dotenv";

// Load environment variables from .env file
config();

export default defineConfig({
  plugins: [
    solidPlugin(), 
    injectPayloadPlugin({
      payloadPath: process.env.QC_PAYLOAD_PATH,
      dataPath: process.env.QC_DATA_PATH,
      structurePath: process.env.QC_STRUCTURE_PATH,
      autoGenerate: process.env.QC_AUTO_GENERATE !== 'false'
    }),
    viteSingleFile()
  ],
  build: {
    target: "esnext",
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    format: "es",
    plugins: () => [solidPlugin()]
  },
});
