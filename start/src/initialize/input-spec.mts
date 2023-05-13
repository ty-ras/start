import chalk from "chalk";
import * as S from "@effect/schema/Schema";
import * as mi from "meow-inquirer";
import type * as createTemplate from "../write/index.mjs";

const inputSpec = {
  generalMessage: {
    type: mi.TYPE_MESSAGE,
    orderNumber: 0,
    message: chalk.bold.bgBlueBright("# Initialize created project"),
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
  },
} as const satisfies InputSpecGeneric;

export default inputSpec;

export type DynamicValueInput = createTemplate.ValidatedInput;
export type InputSpec = typeof inputSpec;
export type InputSpecGeneric = mi.InputSpec<DynamicValueInput>;
export type InputFromCLIOrUser = mi.InputFromCLIOrUser<InputSpec>;
export type SchemaKeys = mi.SchemaKeys<InputSpec>;
