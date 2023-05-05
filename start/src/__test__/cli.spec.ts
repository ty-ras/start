/* eslint-disable no-console */
import test from "ava";
import * as cliUtils from "./cli-utils";
import testTemplateGeneration, { targetDirectory } from "./templates";
import testHelpText from "./help";

// These are hardly "unit" tests, but oh well... :)

// Before running tests, transpile source code once
test.before("Transpile source code", async () => {
  console.info("Target directory is", targetDirectory);
  console.info("Beginning invoking TSC");
  await cliUtils.execFile("yarn", ["run", "tsc"], { shell: false });
  await cliUtils.execFile("yarn", ["run", "chmodx"], { shell: false });
  console.info("Finished invoking TSC");
});

test("Verify that help string is expected", testHelpText);

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
  4,
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
  4,
);
