import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from 'path';


export default defineConfig({
  plugins: [react()],
   build: {
    outDir: path.resolve(__dirname, '../dist'),
    emptyOutDir: true,
  },
});
