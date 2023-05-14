import chalk from "chalk";
import * as mi from "meow-inquirer";
import type * as validateInput from "./validate-input.mjs";
import type * as writeProject from "../write/index.mjs";
import * as process from "node:child_process";

export default async (
  { folderName, packageManager }: writeProject.ValidatedInput,
  { setupGit, installDependencies }: validateInput.ValidatedInput,
) => {
  // Initialize Git if specified
  if (setupGit === true) {
    await spawnPassThruAndWait(
      folderName,
      "Initializing project with Git.",
      "git",
      ["init", "--initial-branch", "main"],
    );
  }
  // Install dependencies if specified
  if (installDependencies === true) {
    await spawnPassThruAndWait(
      folderName,
      `Installing dependencies with "${packageManager}"`,
      packageManager,
      ["install"],
    );
  }
};

const spawnPassThruAndWait = async (
  folderName: string,
  stepDescription: string,
  executable: string,
  args: ReadonlyArray<string>,
) => {
  mi.print(chalk.italic(chalk.gray(stepDescription)));
  const child = process.spawn(executable, args, {
    cwd: folderName,
    shell: false,
    // Don't provide stdin, and make all out/err output to be printed to this process
    stdio: ["ignore", "inherit", "inherit"],
  });
  const exitCode = await new Promise<number | NodeJS.Signals>((resolve) =>
    child.once("exit", (code, signal) => resolve(code ?? signal ?? -1)),
  );

  if (exitCode === 0) {
    mi.print("");
  } else {
    mi.print(
      chalk.red(
        `Calling "${executable}" failed: ${
          typeof exitCode === "number"
            ? `exit code ${exitCode}`
            : `signal "${exitCode}"`
        }`,
      ),
    );
  }
};
