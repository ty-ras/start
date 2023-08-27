import { type ExecutionContext } from "ava";
import * as S from "@effect/schema/Schema";
import * as F from "@effect/data/Function";
import * as process from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type * as input from "../write/input-spec.mjs";
import type * as initInput from "../initialize/input-spec.mjs";
import type * as pJson from "../write/package-json.mjs";
import * as writeFiles from "../write/write-project.mjs";
import * as cliUtils from "./cli-utils.js";

// This must not be inside of "start" folder in git root, otherwise the dependencies installed in this project will intervene with the ones used in tests.
const testOutputDir = path.join(
  new URL(import.meta.url).pathname,
  "..",
  "..",
  "..",
  "..",
  "start-tests",
);
await fs.mkdir(testOutputDir, { recursive: true });
export const TARGET_DIR = await fs.mkdtemp(
  path.join(testOutputDir, "test-run-"),
);

// This callback is parametrized test macro to run a successful test with given input
export default async (
  c: ExecutionContext,
  args: input.InputFromCLIOrUser & initInput.InputFromCLIOrUser,
  expectedAssertCount: number,
) => {
  c.plan(expectedAssertCount);
  await c.notThrowsAsync(
    runCLIAndVerify(c, {
      args: {
        [FOLDER_NAME]: path.join(
          TARGET_DIR,
          `${args.components}-${args.dataValidation}-${args.server ?? "none"}-${
            args.client ?? "none"
          }`,
        ),
        packageManager: "yarn",
        ...args,
      },
    }),
  );
};

const runCLIAndVerify = async (
  c: ExecutionContext,
  { args, stdinLines }: CLIArgs,
) => {
  const hasStdin = !!stdinLines && stdinLines.length > 0;
  const processArgs = Object.entries(args ?? {}).reduce<Array<string>>(
    (cliArgs, [propName, propValue]) => (
      propName === FOLDER_NAME
        ? cliArgs.push(`${propValue}`)
        : cliArgs.unshift(`--${propName}`, `${propValue}`),
      cliArgs
    ),
    [],
  );
  const child = process.spawn(cliUtils.pathToCLI, processArgs, {
    cwd: "/",
    shell: false,
    stdio: [hasStdin ? "pipe" : "ignore", "pipe", "pipe"],
  });
  const outputs = collectProcessOutputs(child);
  if (hasStdin) {
    child.stdin?.write(stdinLines.join("\n"));
    child.stdin?.end();
  }

  await waitForProcessWithTimeout("Creating starter template", child, outputs);

  await verifyTemplate(
    c,
    args?.folderName ?? "/no-folder-name-supplied",
    args?.packageManager ?? "false",
    args?.server,
    args?.client,
  );
};

interface CLIArgs {
  // Notice that using stdin to specify any response to 'choice' question is not an option at least while simulating key strokes for child processes is not an option: https://github.com/nodejs/node/issues/43137
  stdinLines?: ReadonlyArray<string>;
  args?: input.InputFromCLIOrUser;
}

const verifyTemplate = async (
  c: ExecutionContext,
  projectPath: string,
  packageManager: string,
  server: string | undefined,
  client: string | undefined,
) => {
  const packageJsonPaths = (
    await writeFiles.getAllFilePaths(
      projectPath,
      (dirName) => !dirName.endsWith("node_modules"),
    )
  ).filter((filePath) => path.basename(filePath) === "package.json");
  c.true(
    packageJsonPaths.length > 0,
    "There must be at least one package.json path in resulting template",
  );

  c.deepEqual(
    (
      await tryStat(
        path.join(
          projectPath,
          "node_modules",
          "@ty-ras",
          `server${server === undefined ? "" : `-${server}`}`,
        ),
      )
    )?.isDirectory(),
    server === undefined ? undefined : true,
    "The server-specific package must (not) be installed",
  );

  c.deepEqual(
    (
      await tryStat(
        path.join(
          projectPath,
          "node_modules",
          "@ty-ras",
          `client${client === undefined ? "" : `-${client}`}`,
        ),
      )
    )?.isDirectory(),
    client === undefined ? undefined : true,
    "The client-specific package must (not) be installed",
  );

  const manyPackageJsons = packageJsonPaths.length > 1;

  const verifySinglePackage = createVerifySinglePackage(
    c,
    projectPath,
    packageManager,
    !manyPackageJsons,
  );

  const packageJsonsContents = await Promise.all(
    packageJsonPaths.map(verifySinglePackage),
  );

  await verifyProjectOtherFiles(c, projectPath);

  if (packageJsonsContents.length > 1) {
    const allProjectNames = new Set(
      packageJsonsContents.map(({ name }) => name),
    );
    let accumulatedDependencies: pJson.PackageDependencies = {};
    for (const { dependencies, devDependencies } of packageJsonsContents) {
      c.true(
        Object.keys(dependencies).every(
          (key) =>
            allProjectNames.has(key) || !(key in accumulatedDependencies),
        ),
        "There must not be overlapping dependencies between dependencies",
      );
      c.true(
        Object.keys(devDependencies).every(
          (key) =>
            allProjectNames.has(key) || !(key in accumulatedDependencies),
        ),
        "There must not be overlapping dependencies between development dependencies",
      );
      accumulatedDependencies = {
        ...accumulatedDependencies,
        ...dependencies,
        ...devDependencies,
      };
    }
  }
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
    new Promise<void>((resolve) => setTimeout(resolve, 120_000)),
  ]);

  if (maybeExitCode !== 0) {
    if (maybeExitCode === undefined) {
      child.kill();
    }
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
  S.parseSync,
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

const tryStat = async (path: string) => {
  try {
    return await fs.stat(path);
  } catch {
    return undefined;
  }
};

const createVerifySinglePackage = (
  c: ExecutionContext,
  projectPath: string,
  packageManager: string,
  isOnePackageJson: boolean,
) => {
  const runPackageDev = async (
    name: string,
    cwd: string,
    yarnExtraArgs: ReadonlyArray<string>,
    isFE: boolean,
  ) => {
    const devRun = process.spawn(
      packageManager,
      [...yarnExtraArgs, "run", isFE ? "build" : "dev"],
      {
        shell: false,
        cwd,
      },
    );
    const outputCollectState = collectProcessOutputs(devRun);

    await c.notThrowsAsync(
      async () =>
        await waitForProcessWithTimeout(
          `Starting dev run for "${name}"`,
          devRun,
          outputCollectState,
          waitForProcessPrinting(devRun, outputCollectState, {
            stdout: isFE ? "✓ built in" : "Started server at",
          }),
        ),
    );
  };
  // eslint-disable-next-line sonarjs/cognitive-complexity
  return async (packageJsonPath: string) => {
    // Read package.json, verify it has no floating version specs
    const packageJsonContents = F.pipe(
      await fs.readFile(packageJsonPath, "utf8"),
      JSON.parse,
      parsePackageJson,
    );
    const { name, dependencies, devDependencies } = packageJsonContents;
    c.true(
      Object.values(dependencies)
        .concat(Object.values(devDependencies))
        .every((version) => /^\d/.test(version)),
      `All dependencies of ${packageJsonPath} must have resolved version`,
    );
    const packageDir = path.dirname(packageJsonPath);
    // Don't do anything for top-level package.json if we are in multi-package.json template
    if (isOnePackageJson || packageDir !== projectPath) {
      const yarnExtraArgs =
        packageManager === "yarn" && !isOnePackageJson
          ? ["workspace", name]
          : [];
      const cwd = packageManager === "yarn" ? projectPath : packageDir;

      // Now run tsc, to ensure no compilation errors exist
      await c.notThrowsAsync(
        async () =>
          await cliUtils.execFile(
            packageManager,
            [...yarnExtraArgs, "run", "build"],
            {
              shell: false,
              cwd,
            },
          ),
      );

      // Now run also lint, to ensure code is formatted correctly
      await c.notThrowsAsync(
        async () =>
          await cliUtils.execFile(
            packageManager,
            [...yarnExtraArgs, "run", "lint"],
            {
              shell: false,
              cwd,
            },
          ),
      );

      // Make sure program actually starts and prints information that it successfully initialized
      const packageKind: PackageKind =
        (await tryStat(path.join(packageDir, "vite.config.ts"))) !== undefined
          ? "fe"
          : (await tryStat(path.join(packageDir, "tsconfig.build.json"))) !==
            undefined
          ? "be"
          : "protocol";
      // Don't try to run protocol package - it is library-only
      if (packageKind !== "protocol") {
        await c.notThrowsAsync(
          async () =>
            await runPackageDev(name, cwd, yarnExtraArgs, packageKind === "fe"),
        );
      }
    }
    return packageJsonContents;
  };
};

const FOLDER_NAME = "folderName";

const verifyProjectOtherFiles = async (
  c: ExecutionContext,
  projectDir: string,
) => {
  // There are other files present too, but them being missing/containing wrong input will be catched by running build/lint commands.
  // These files, however, will not affect outcome of those commands, and thus must be verified manually
  await Promise.all(
    [".gitignore", ".prettierrc", "README.md"].map(async (filePath) =>
      c.deepEqual(
        (await fs.stat(path.join(projectDir, filePath))).isFile(),
        true,
      ),
    ),
  );
};
