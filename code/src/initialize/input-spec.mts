import chalk from "chalk";
import * as S from "@effect/schema/Schema";
import * as mi from "meow-inquirer";
import type * as createTemplate from "../write/index.mjs";

import * as childProcess from "node:child_process";
import * as util from "node:util";
const execFile = util.promisify(childProcess.execFile);

const inputSpec = {
  generalMessage: {
    type: mi.TYPE_MESSAGE,
    orderNumber: 0,
    message: `${chalk.bold.bgBlueBright(
      "# Initialize created project",
    )}\n${chalk.italic(
      chalk.gray("Press Ctrl-D to stop answering these optional questions"),
    )}`,
  },
  setupGit: {
    type: mi.TYPE_VALIDATE,
    orderNumber: 1,
    schema: S.boolean,
    prompt: {
      type: "confirm",
      message: "Should the project folder be initialized with Git?",
      default: false,
    },
    flag: {
      type: "boolean",
      isRequired: false,
      shortFlag: "g",
    },
    condition: {
      description: "Only if Git is detected to be installed",
      isApplicable: async () =>
        // We don't need to check existance of .git directory, as the previous step requires that target directory is empty.
        await isExecWorking("git", "project initialization with Git"),
    },
  },
  installDependencies: {
    type: mi.TYPE_VALIDATE,
    orderNumber: 2,
    schema: S.boolean,
    prompt: {
      type: "confirm",
      message: "Should the project dependencies be installed?",
      default: false,
    },
    flag: {
      type: "boolean",
      isRequired: false,
      shortFlag: "i",
    },
    condition: {
      description:
        "Only if selected package manager is detected to be installed",
      isApplicable: async ({ packageManager }) => {
        return packageManager === "unspecified"
          ? false
          : await isExecWorking(
              packageManager,
              `installing project dependencies with ${packageManager}`,
            );
      },
    },
  },
} as const satisfies InputSpecGeneric;

export default inputSpec;

export type DynamicValueInput = createTemplate.ValidatedInput;
export type InputSpec = typeof inputSpec;
export type InputSpecGeneric = mi.InputSpec<DynamicValueInput>;
export type InputFromCLIOrUser = mi.InputFromCLIOrUser<InputSpec>;
export type SchemaKeys = mi.SchemaKeys<InputSpec>;

const isExecWorking = async (executable: string, thingToSkip: string) => {
  try {
    await execFile(executable, ["--version"], {
      shell: false,
    });
    return true;
  } catch (e) {
    // Failed - most likely no git installed
    return `Skipping ${thingToSkip}, ${
      e instanceof Error
        ? e.message === `spawn ${executable} ENOENT`
          ? "as it is not installed"
          : `"${e.message}"`
        : "due to unknown error"
    }`;
  }
};
