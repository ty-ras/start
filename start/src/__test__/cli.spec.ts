import test from "ava";
import testTemplateGeneration, { TARGET_DIR, EXTERNAL_DIR } from "./templates";

// These are hardly "unit" tests, but oh well... :)

// Notice that all the source code is transpiled already before via script in package.json
test.before("Transpile source code", () => {
  // eslint-disable-next-line no-console
  console.info("Target directory is", TARGET_DIR);
  // eslint-disable-next-line no-console
  console.info("External directory is", EXTERNAL_DIR);
});

// We must run template generation tests in serial - otherwise there will be so many connections established that there will be errors
// Furthermore, due to nature of the program, running tests in sequential manner is actually a bit faster.
const runOneTest = test.serial;

runOneTest("Test BE-IOTS-NODE", testTemplateGeneration, {
  components: "be",
  dataValidation: "io-ts",
  server: "node",
});

runOneTest("Test FE-IOTS-FETCH", testTemplateGeneration, {
  components: "fe",
  dataValidation: "io-ts",
  client: "fetch",
});

runOneTest(
  "Test BEFE-IOTS-NODE-FETCH",
  testTemplateGeneration,
  {
    components: "be-and-fe",
    dataValidation: "io-ts",
    server: "node",
    client: "fetch",
  },
  19,
);

runOneTest("Test BE-ZOD-NODE", testTemplateGeneration, {
  components: "be",
  dataValidation: "zod",
  server: "node",
});

runOneTest("Test FE-ZOD-FETCH", testTemplateGeneration, {
  components: "fe",
  dataValidation: "zod",
  client: "fetch",
});

runOneTest(
  "Test BEFE-ZOD-NODE-FETCH",
  testTemplateGeneration,
  {
    components: "be-and-fe",
    dataValidation: "zod",
    server: "node",
    client: "fetch",
  },
  19,
);

runOneTest(
  "Test BEFE-IOTS-NODE-FETCH with PNPM",
  testTemplateGeneration,
  {
    components: "be-and-fe",
    dataValidation: "zod",
    server: "node",
    client: "fetch",
    packageManager: "pnpm",
    folderName: EXTERNAL_DIR,
    installDependencies: true,
  },
  19,
);
