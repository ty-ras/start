import chalk from "chalk";
import * as F from "@effect/data/Function";
import * as S from "@effect/schema/Schema";
import * as path from "node:path";
import * as process from "node:process";
import type * as stageTypes from "../stages";

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

const stages = {
  generalMessage: {
    orderNumber: 0,
    message: chalk.bold.bgBlueBright("# General project configuration"),
  },
  folderName: {
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
    orderNumber: 2,
    schema: S.keyof(
      S.struct({ yarn: S.any, npm: S.any, pnpm: S.any, unspecified: S.any }),
    ),
    prompt: {
      type: "list",
      message: "Which package manager will be used in the project?",
      default: "yarn",
      choices: [
        { name: "Yarn", value: "yarn" },
        { name: "NPM", value: "npm" },
        { name: "PNPM", value: "pnpm" },
        {
          name: "Decide on your own after project creation",
          value: "unspecified",
        },
      ],
    },
    flag: {
      type: "string",
      isRequired: false,
      alias: "m",
    },
  },
  components: {
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
      alias: "p",
    },
  },
  dataValidation: {
    orderNumber: 4,
    schema: S.keyof(S.struct({ ["io-ts"]: S.any, zod: S.any })),
    prompt: {
      type: "list",
      message: "Which data validation framework should TyRAS be providing?",
      default: "io-ts",
      choices: [
        { name: "IO-TS", value: "io-ts" },
        { name: "Zod", value: "zod" },
        { name: "Runtypes", value: "runtypes", disabled: true },
      ],
    },
    flag: {
      type: "string",
      isRequired: false,
      alias: "d",
    },
  },
  beMessage: {
    orderNumber: 5,
    message: (components) =>
      hasBEComponent.isApplicable(components)
        ? chalk.bold.bgBlueBright("# Backend-specific project configuration:")
        : undefined,
  },
  server: {
    orderNumber: 6,
    schema: S.keyof(S.struct({ node: S.any })),
    prompt: {
      type: "list",
      message: "Which server should TyRAS be providing?",
      default: "node",
      choices: [
        { name: "Node HTTP(S) 1/2 server", value: "node" },
        { name: "Koa", value: "koa", disabled: true },
        { name: "ExpressJS", value: "expressjs", disabled: true },
        { name: "Fastify", value: "fastify", disabled: true },
      ],
    },
    flag: {
      type: "string",
      isRequired: false,
      alias: "s",
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
    orderNumber: 7,
    message: (components) =>
      hasFEComponent.isApplicable(components)
        ? chalk.bold.bgBlueBright("# Frontend-specific project configuration:")
        : undefined,
  },
  client: {
    orderNumber: 8,
    schema: S.keyof(S.struct({ fetch: S.any })),
    prompt: {
      type: "list",
      message: "Which client should TyRAS be providing?",
      default: "fetch",
      choices: [
        { name: "Fetch API", value: "fetch" },
        { name: "Node Request API", value: "node", disabled: true },
        { name: "Axios", value: "axios", disabled: true },
      ],
    },
    flag: {
      type: "string",
      isRequired: false,
      alias: "c",
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
} as const satisfies StagesGeneric;

export default stages;

export type Stages = typeof stages;
export type StagesGeneric = stageTypes.StagesGeneric<Components>;
export type Stage = stageTypes.Stage<Components>;
export type CommonStage = stageTypes.CommonStage;
export type StateMutatingStage = stageTypes.StateMutatingStage<Components>;
export type MessageStage = stageTypes.MessageStage<Components>;
export type Components = S.To<typeof componentsSchema>;
export type ConditionWithDescription =
  stageTypes.ConditionWithDescription<Components>;
