import test from "ava";
import * as process from "node:child_process";
import * as util from "node:util";
const execFile = util.promisify(process.execFile);

// These are hardly "unit" tests, but oh well... :)

test.before("Transpile source code", async () => {
  // eslint-disable-next-line no-console
  console.info("Beginning invoking TSC");
  await execFile("yarn", ["run", "tsc"]);
  // eslint-disable-next-line no-console
  console.info("Finished invoking TSC");
});

test("Test with user input only", async (c) => {
  c.plan(1);
  await c.notThrowsAsync(
    runCLIAndVerify({
      stdinLines: [
        // Target directory
        "./my-project",
      ],
    }),
  );
});

const runCLIAndVerify = async ({ args, stdinLines }: CLIArgs) => {
  const hasStdin = !!stdinLines && stdinLines.length > 0;
  const child = process.spawn("node", ["dist/cli.mjs", ...(args ?? [])], {
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
    new Promise<void>((resolve) => setTimeout(resolve, ONE_INVOCATION_TIMEOUT)),
  ]);

  if (maybeExitCode !== 0) {
    throw new Error(
      `${
        typeof maybeExitCode !== "undefined"
          ? `Starter template exited with ${maybeExitCode}`
          : "Timeout"
      }..\nSTDOUT\n${stdout}\nSTDERR\n${stderr}\n`,
    );
  }
};

interface CLIArgs {
  stdinLines?: ReadonlyArray<string>;
  args?: ReadonlyArray<string>;
}

const ONE_INVOCATION_TIMEOUT = 10 * 1000;
