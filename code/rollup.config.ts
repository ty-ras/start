import globby from "globby";
import { defineConfig } from "rollup";
import dts from "rollup-plugin-dts";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import license from "rollup-plugin-license";

const outDir = "bundle";
const config = defineConfig({
  input: await globby("dist/*.mjs"),
  output: {
    dir: outDir,
    interop: "esModule",
    generatedCode: {
      preset: "es2015",
    },
    chunkFileNames: "[name].js",
    manualChunks: (id) => {
      if (id.includes("node_modules")) {
        return "dependencies";
      }
    },
    hoistTransitiveImports: false,
  },
  treeshake: {
    moduleSideEffects: "no-external",
  },
  plugins: [
    nodeResolve(),
    commonjs({
      include: "node_modules/**",
    }),
    json(),
    license({
      thirdParty: {
        output: `${outDir}/licenses.md`,
      },
    }),
  ],
});

// At least for now, this is close to useless, as index.d.mts is already not referencing anything external
// But maybe in the future it will be more complex, actually exporting something related to this library.
const dtsConfig = defineConfig({
  input: "dist-ts/index.d.mts",
  output: {
    file: `${outDir}/index.d.mts`,
    format: "es",
  },
  plugins: [
    dts({
      respectExternal: true,
    }),
  ],
});

export default [config, dtsConfig];
