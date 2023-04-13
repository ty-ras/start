/* eslint-disable no-console */
import test, { type ExecutionContext } from "ava";
import * as S from "@effect/schema/Schema";
import * as F from "@effect/data/Function";
import * as process from "node:child_process";
import * as util from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as input from "../collect-input.mjs";
import * as template from "../create-template.mjs";

const execFile = util.promisify(process.execFile);

const testOutputDir = path.join(
  new URL(import.meta.url).pathname,
  "..",
  "..",
  "..",
  "test-output",
);
await fs.mkdir(testOutputDir, { recursive: true });
const tmpDir = await fs.mkdtemp(path.join(testOutputDir, "test-run-"));

// These are hardly "unit" tests, but oh well... :)

// Before running tests, transpile source code once
test.before("Transpile source code", async () => {
  console.info("Target directory is", tmpDir);
  console.info("Beginning invoking TSC");
  await execFile("yarn", ["run", "tsc"], { shell: false });
  console.info("Finished invoking TSC");
});

// This callback is parametrized test macro to run a successful test with given input
const testSuccessfulRun = async (
  c: ExecutionContext,
  args: input.InputFromCLIOrUser,
  expectedPackageJsonCount = 1,
) => {
  c.plan(2 + expectedPackageJsonCount);
  await c.notThrowsAsync(
    runCLIAndVerify(c, {
      args: {
        folderName: path.join(
          tmpDir,
          `${args.components}-${args.dataValidation}-${args.server ?? "none"}-${
            args.client ?? "none"
          }`,
        ),
        ...args,
      },
    }),
  );
};

// test("Test BE-IOTS-NODE", testSuccessfulRun, {
//   components: "be",
//   dataValidation: "io-ts",
//   server: "node",
// });

// test("Test FE-IOTS-FETCH", testSuccessfulRun, {
//   components: "fe",
//   dataValidation: "io-ts",
//   client: "fetch",
// });

test("Test BEFE-IOTS-NODE-FETCH", testSuccessfulRun, {
  components: "be-and-fe",
  dataValidation: "io-ts",
  server: "node",
  client: "fetch",
});

const runCLIAndVerify = async (
  c: ExecutionContext,
  { args, stdinLines }: CLIArgs,
) => {
  const hasStdin = !!stdinLines && stdinLines.length > 0;
  const processArgs = Object.entries(args ?? {}).reduce<Array<string>>(
    (cliArgs, [propName, propValue]) => (
      propName === input.FOLDER_NAME
        ? cliArgs.push(`${propValue}`)
        : cliArgs.unshift(`--${propName}`, `${propValue}`),
      cliArgs
    ),
    [],
  );
  const child = process.spawn("node", [`dist/cli.mjs`, ...processArgs], {
    shell: false,
    stdio: [hasStdin ? "pipe" : "ignore", "pipe", "pipe"],
  });
  const outputs = collectProcessOutputs(child);
  if (hasStdin) {
    child.stdin?.write(stdinLines.join("\n"));
    child.stdin?.end();
  }

  await waitForProcessWithTimeout("Creating starter template", child, outputs);

  await verifyTemplate(c, args?.folderName ?? "/no-folder-name-supplied");
};

interface CLIArgs {
  // Notice that using stdin to specify any response to 'choice' question is not an option at least while simulating key strokes for child processes is not an option: https://github.com/nodejs/node/issues/43137
  stdinLines?: ReadonlyArray<string>;
  args?: input.InputFromCLIOrUser;
}

const verifyTemplate = async (c: ExecutionContext, projectPath: string) => {
  const packageJsonPaths = await template.getAllPackageJsonPaths(projectPath);
  c.true(
    packageJsonPaths.length > 0,
    "There must be at least one package.json path in resulting template",
  );
  const isOnePackageJson = packageJsonPaths.length === 1;

  await Promise.all(
    // eslint-disable-next-line sonarjs/cognitive-complexity
    packageJsonPaths.map(async (packageJsonPath) => {
      // Read package.json, verify it has no floating version specs
      const { name, dependencies, devDependencies } = F.pipe(
        await fs.readFile(packageJsonPath, "utf8"),
        JSON.parse,
        parsePackageJson,
      );
      c.true(
        Object.values(dependencies)
          .concat(Object.values(devDependencies))
          .every((version) => /^\d/.test(version)),
      );
      const packageDir = path.dirname(packageJsonPath);
      if (isOnePackageJson || packageDir !== projectPath) {
        const yarnExtraArgs = isOnePackageJson ? [] : ["workspace", name];

        // Now run tsc, to ensure no compilation errors exist
        await execFile("yarn", [...yarnExtraArgs, "run", "tsc"], {
          shell: false,
          cwd: projectPath,
        });

        // Make sure program actually starts and prints information that it successfully initialized
        let packageKind: PackageKind = "protocol";
        try {
          await fs.stat(path.join(packageDir, "vite.config.ts"));
          packageKind = "fe";
        } catch {
          // Try BE-specific file
          try {
            await fs.stat(path.join(packageDir, "tsconfig.build.json"));
            packageKind = "be";
          } catch {
            // Ignore
          }
        }
        if (packageKind !== "protocol") {
          const isFE = packageKind === "fe";
          const devRun = process.spawn(
            "yarn",
            [...yarnExtraArgs, "run", isFE ? "build" : "dev"],
            {
              shell: false,
              cwd: projectPath,
            },
          );
          const outputCollectState = collectProcessOutputs(devRun);

          await waitForProcessWithTimeout(
            `Starting dev run for "${name}"`,
            devRun,
            outputCollectState,
            waitForProcessPrinting(devRun, outputCollectState, {
              stdout: isFE ? "✓ built in" : "Started server",
            }),
          );
        }
      }
    }),
  );
};

const waitForProcessWithTimeout = async (
  processKind: string,
  child: process.ChildProcess,
  outputCollectState: ProcessOutputCollectState,
  waitForProcess?: Promise<number | NodeJS.Signals>,
) => {
  const maybeExitCode = await Promise.any([
    // This promise waits for custom event, or the exit event, if not specific
    waitForProcess ?? waitForProcessExit(child),
    // This promise waits on timeout
    new Promise<void>((resolve) => setTimeout(resolve, 20_1000)),
  ]);

  if (maybeExitCode !== 0) {
    throw new Error(
      `${processKind} ${
        typeof maybeExitCode !== "undefined"
          ? `exited with ${maybeExitCode}`
          : "failed to complete in sufficient time"
      }.
STDOUT
${outputCollectState.stdout}
STDERR
${outputCollectState.stderr}
`,
    );
  }
};

interface RunProcessUntilPrinting {
  stdout?: string;
  stderr?: string;
}

const parsePackageJson = F.pipe(
  S.struct({
    name: S.string,
    dependencies: S.record(S.string, S.string),
    devDependencies: S.record(S.string, S.string),
  }),
  S.parse,
);

interface ProcessOutputCollectState {
  stdout: string;
  stderr: string;
}

const collectProcessOutputs = (child: process.ChildProcess) => {
  const retVal: ProcessOutputCollectState = {
    stdout: "",
    stderr: "",
  };
  child.stdout?.on("data", (chunk) => (retVal.stdout += `${chunk}`));
  child.stderr?.on("data", (chunk) => (retVal.stderr += `${chunk}`));
  return retVal;
};

const waitForProcessExit = (child: process.ChildProcess) =>
  new Promise<number | NodeJS.Signals>((resolve) =>
    child.once("exit", (code, signal) => resolve(code ?? signal ?? -1)),
  );

const waitForProcessPrinting = async (
  child: process.ChildProcess,
  outputCollectState: ProcessOutputCollectState,
  { stdout, stderr }: RunProcessUntilPrinting,
) => {
  let exitCodeOrSignal: undefined | number | NodeJS.Signals;
  child.once("exit", (ec, signal) => (exitCodeOrSignal = ec ?? signal ?? -1));
  const targetStdoutState = !!stdout;
  const targetStderrState = !!stderr;
  const getCurrentState = (isStdout: boolean) => {
    const stringToSearch = isStdout ? stdout : stderr;
    return (
      !!stringToSearch &&
      outputCollectState[isStdout ? "stdout" : "stderr"].indexOf(
        stringToSearch,
      ) >= 0
    );
  };
  let foundText: boolean;
  while (
    !(foundText =
      getCurrentState(true) === targetStdoutState &&
      getCurrentState(false) === targetStderrState) &&
    exitCodeOrSignal === undefined
  ) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (foundText) {
    child.kill();
  }

  return foundText ? 0 : exitCodeOrSignal || -1;
};

type PackageKind = "be" | "fe" | "protocol";
