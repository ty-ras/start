import test, { type ExecutionContext } from "ava";
import * as process from "node:child_process";
import * as util from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as input from "../collect-input.mjs";
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
  // eslint-disable-next-line no-console
  console.info("Beginning invoking TSC", tmpDir);
  await execFile("yarn", ["run", "tsc"], { shell: false });
  // eslint-disable-next-line no-console
  console.info("Finished invoking TSC");

  // We also need to create dummy package.json in order to load also libraries in ESM mode.
  await fs.writeFile(
    "dist/package.json",
    JSON.stringify({
      name: "dist",
      type: "module",
    }),
    "utf8",
  );
});

// This callback is parametrized test macro to run a successful test with given input
const testSuccessfulRun = async (
  c: ExecutionContext,
  args: input.InputFromCLIOrUser,
) => {
  c.plan(2);
  await c.notThrowsAsync(
    runCLIAndVerify(c, {
      args,
    }),
  );
};

test("Test BE-IOTS-NODE", testSuccessfulRun, {
  components: "be",
  dataValidation: "io-ts",
  server: "node",
  folderName: path.join(tmpDir, "be-iots-node"),
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
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => (stdout += `${chunk}`));
  child.stderr?.on("data", (chunk) => (stderr += `${chunk}`));
  if (hasStdin) {
    child.stdin?.write(stdinLines.join("\n"));
    child.stdin?.end();
  }

  const maybeExitCode = await Promise.any([
    // This promise waits for the exit event
    new Promise<number | string>((resolve) =>
      child.once("exit", (code, signal) => resolve(code ?? signal ?? -1)),
    ),
    // This promise waits on timeout
    new Promise<void>((resolve) => setTimeout(resolve, 20_1000)),
  ]);

  if (maybeExitCode !== 0) {
    throw new Error(
      `${
        typeof maybeExitCode !== "undefined"
          ? `Starter template exited with ${maybeExitCode}`
          : "Timeout"
      }.
STDOUT
${stdout}
STDERR
${stderr}
`,
    );
  }

  await verifyTemplate(c, args?.folderName ?? "/no-folder-name-supplied");
};

interface CLIArgs {
  // Notice that using stdin to specify any response to 'choice' question is not an option at least while simulating key strokes for child processes is not an option: https://github.com/nodejs/node/issues/43137
  stdinLines?: ReadonlyArray<string>;
  args?: input.InputFromCLIOrUser;
}

const verifyTemplate = async (c: ExecutionContext, projectPath: string) => {
  const statResult = await fs.stat(path.join(projectPath, "package.json"));
  c.true(statResult.isFile());
  await execFile("yarn", ["run", "tsc"], { shell: false, cwd: projectPath });
};
