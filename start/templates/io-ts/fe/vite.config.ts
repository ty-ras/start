import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({command, mode}) =>({
  plugins: [
    react(),
    // tsconfigPaths(),
  ],
  clearScreen: false,
  build: {
    outDir: "./dist",
    emptyOutDir: true
  },
  server: {
    host: "0.0.0.0", // "127.0.0.1",
    port: 3001
  }
}));
