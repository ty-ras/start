import test from "ava";
import testTemplateGeneration, { TARGET_DIR } from "./templates";
import * as input from "../write/input-spec.mjs";
import type * as initInput from "../initialize/input-spec.mjs";

import * as path from "node:path";

// These are hardly "unit" tests, but oh well... :)

// Notice that all the source code is transpiled already before via script in package.json
test.before("Transpile source code", () => {
  // eslint-disable-next-line no-console
  console.info("Target directory is", TARGET_DIR);
});

// We must run template generation tests in serial - otherwise there will be so many connections established that there will be errors
// Furthermore, due to nature of the program, running tests in sequential manner is actually a bit faster.
const runOneTest = test.serial;

for (const testArg of Array.from(generateAllTestCombinations())) {
  runOneTest(
    `Specific: Test ${testArg.dataValidation}-${testArg.server ?? "none"}-${
      testArg.client ?? "none"
    }`,
    testTemplateGeneration,
    testArg,
    testArg.components === "be-and-fe" ? 29 : 12,
  );
}

runOneTest(
  "Global: Test BEFE-ZOD-NODE-FETCH with PNPM",
  testTemplateGeneration,
  {
    components: "be-and-fe",
    dataValidation: "zod",
    server: "node",
    client: "fetch",
    packageManager: "pnpm",
    folderName: path.join(TARGET_DIR, "pnpm"),
    installDependencies: true,
  },
  19,
);

// eslint-disable-next-line sonarjs/cognitive-complexity
function* generateAllTestCombinations() {
  for (const dataValidation of ["io-ts", "runtypes", "zod"] as const) {
    for (const server of [
      undefined,
      "node",
      "koa",
      "express",
      "fastify",
    ] as const) {
      for (const client of [undefined, "fetch"] as const) {
        if (client !== undefined || server !== undefined) {
          const testArg: input.InputFromCLIOrUser &
            initInput.InputFromCLIOrUser = Object.assign(
            {
              installDependencies: true,
              dataValidation,
              components:
                client === undefined
                  ? ("be" as const)
                  : server === undefined
                  ? ("fe" as const)
                  : ("be-and-fe" as const),
            },
            client === undefined ? {} : { client },
            server === undefined ? {} : { server },
          );
          yield testArg;
        }
      }
    }
  }
}
