import chalk from "chalk";
import * as F from "@effect/data/Function";
import * as S from "@effect/schema/Schema";
import * as mi from "meow-inquirer";
import * as path from "node:path";
import * as process from "node:process";

const hasBEComponent: ConditionWithDescription = {
  description: 'Used only when components is "be" or "be-and-fe".',
  isApplicable: (components) => components !== "fe",
};

const hasFEComponent: ConditionWithDescription = {
  description: 'Used only when components is "fe" or "be-and-fe".',
  isApplicable: (components) => components !== "be",
};

const componentsSchema = S.keyof(
  S.struct({ be: S.any, fe: S.any, ["be-and-fe"]: S.any }),
);

export const PACKAGE_MANAGER_NPM = "npm";
export const PACKAGE_MANAGER_YARN = "yarn";
export const PACKAGE_MANAGER_PNPM = "pnpm";
export const PACKAGE_MANAGER_UNSPECIFIED = "unspecified";

const inputSpec = {
  generalMessage: {
    type: mi.TYPE_MESSAGE,
    orderNumber: 0,
    message: chalk.bold.bgBlueBright("# Creating project"),
  },
  folderName: {
    type: mi.TYPE_VALIDATE,
    orderNumber: 1,
    schema: F.pipe(
      S.string,
      S.nonEmpty({ title: "Folder as non-empty string." }),
      // change path given via cmd args / user input to absolute
      S.transform(
        S.string,
        (rawPath) => path.resolve(rawPath),
        (absolutePath) => path.relative(absolutePath, process.cwd()),
      ),
    ),
    prompt: {
      type: "input",
      message: "Where should the project be created?",
      default: "./my-project",
    },
  },
  packageManager: {
    type: mi.TYPE_VALIDATE,
    orderNumber: 2,
    schema: S.keyof(
      S.struct({
        [PACKAGE_MANAGER_YARN]: S.any,
        [PACKAGE_MANAGER_NPM]: S.any,
        [PACKAGE_MANAGER_PNPM]: S.any,
        [PACKAGE_MANAGER_UNSPECIFIED]: S.any,
      }),
    ),
    prompt: {
      type: "list",
      message: "Which package manager will be used in the project?",
      default: PACKAGE_MANAGER_YARN,
      choices: [
        { name: "Yarn", value: PACKAGE_MANAGER_YARN },
        { name: "NPM", value: PACKAGE_MANAGER_NPM },
        { name: "PNPM", value: PACKAGE_MANAGER_PNPM },
        {
          name: "Other/Decide later",
          value: PACKAGE_MANAGER_UNSPECIFIED,
        },
      ],
    },
    flag: {
      type: "string",
      isRequired: false,
      shortFlag: "m",
    },
  },
  components: {
    type: mi.TYPE_VALIDATE,
    orderNumber: 3,
    schema: componentsSchema,
    prompt: {
      type: "list",
      message: "Which components will be using TyRAS libraries?",
      default: "be-and-fe",
      choices: [
        { name: "Both backend and frontend", value: "be-and-fe" },
        { name: "Only backend", value: "be" },
        { name: "Only frontend", value: "fe" },
      ],
    },
    flag: {
      type: "string",
      isRequired: false,
      shortFlag: "p",
    },
  },
  dataValidation: {
    type: mi.TYPE_VALIDATE,
    orderNumber: 4,
    schema: S.keyof(
      S.struct({ ["io-ts"]: S.any, zod: S.any, runtypes: S.any }),
    ),
    prompt: {
      type: "list",
      message: "Which data validation framework should TyRAS be providing?",
      default: "io-ts",
      choices: [
        { name: "IO-TS", value: "io-ts" },
        { name: "Zod", value: "zod" },
        { name: "Runtypes", value: "runtypes" },
      ],
    },
    flag: {
      type: "string",
      isRequired: false,
      shortFlag: "d",
    },
  },
  beMessage: {
    type: mi.TYPE_MESSAGE,
    orderNumber: 5,
    message: (components) =>
      hasBEComponent.isApplicable(components)
        ? chalk.bold.bgBlueBright("# Backend-specific project configuration:")
        : undefined,
  },
  server: {
    type: mi.TYPE_VALIDATE,
    orderNumber: 6,
    schema: S.keyof(
      S.struct({ node: S.any, koa: S.any, express: S.any, fastify: S.any }),
    ),
    prompt: {
      type: "list",
      message: "Which server should TyRAS be providing?",
      default: "node",
      choices: [
        { name: "Node HTTP(S) 1/2 server", value: "node" },
        { name: "Koa", value: "koa" },
        { name: "ExpressJS", value: "express" },
        { name: "Fastify", value: "fastify" },
      ],
    },
    flag: {
      type: "string",
      isRequired: false,
      shortFlag: "s",
    },
    condition: hasBEComponent,
  },
  // The templates always use extras
  // extrasInBackend: {
  //   orderNumber: 6,
  //   schema: S.boolean,
  //   prompt: {
  //     type: "confirm",
  //     message:
  //       "Should dependency to @ty-ras-extras be added to backend project?",
  //     default: true,
  //   },
  //   flag: {
  //     type: "boolean",
  //     isRequired: false,
  //     alias: "eb",
  //   },
  //   condition: hasBEComponent,
  // },
  feMessage: {
    type: mi.TYPE_MESSAGE,
    orderNumber: 7,
    message: (components) =>
      hasFEComponent.isApplicable(components)
        ? chalk.bold.bgBlueBright("# Frontend-specific project configuration:")
        : undefined,
  },
  client: {
    type: mi.TYPE_VALIDATE,
    orderNumber: 8,
    schema: S.keyof(S.struct({ fetch: S.any, node: S.any, axios: S.any })),
    prompt: {
      type: "list",
      message: "Which client should TyRAS be providing?",
      default: "fetch",
      choices: [
        { name: "Fetch API", value: "fetch" },
        { name: "Node Request API", value: "node" },
        { name: "Axios", value: "axios" },
      ],
    },
    flag: {
      type: "string",
      isRequired: false,
      shortFlag: "c",
    },
    condition: hasFEComponent,
  },
  // The templates always use extras
  // extrasInFrontend: {
  //   orderNumber: 9,
  //   schema: S.boolean,
  //   prompt: {
  //     type: "confirm",
  //     message:
  //       "Should dependency to @ty-ras-extras be added to frontend project?",
  //     default: true,
  //   },
  //   flag: {
  //     type: "boolean",
  //     isRequired: false,
  //     alias: "ef",
  //   },
  //   condition: hasFEComponent,
  // },
} as const satisfies InputSpecGeneric;

export default inputSpec;

export type InputSpec = typeof inputSpec;
export type InputSpecGeneric = mi.InputSpec<Components>;
export type Components = S.To<typeof componentsSchema>;
export type ConditionWithDescription = mi.ConditionWithDescription<Components>;
export type InputFromCLIOrUser = mi.InputFromCLIOrUser<InputSpec>;
export type SchemaKeys = mi.SchemaKeys<InputSpec>;
