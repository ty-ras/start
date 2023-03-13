import gradientString from "gradient-string";
import chalk from "chalk";
import meow, { type AnyFlag, type Result } from "meow";
import inquirer, { type DistinctQuestion } from "inquirer";
import * as readPkgUp from "read-pkg-up";
import * as F from "@effect/data/Function";
import * as S from "@effect/schema";
import * as TF from "@effect/schema/formatter/Tree";

const gradient = gradientString("#0070BB", "#FEBE10", "#BC3F4A");

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
      // Looks like validating paths is not so easy task, so for now this check is fine
    ),
    prompt: {
      type: "input",
      message: "Where should the project be created?",
      default: "./my-project",
    },
  },
  components: {
    orderNumber: 2,
    schema: S.keyof(S.struct({ be: S.any, fe: S.any, ["be-and-fe"]: S.any })),
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
    orderNumber: 3,
    schema: componentsSchema,
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
    orderNumber: 4,
    message: (components) =>
      hasBEComponent(components)
        ? chalk.bold.bgBlueBright("# Backend-specific project configuration:")
        : undefined,
  },
  server: {
    orderNumber: 5,
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
  extrasInBackend: {
    orderNumber: 6,
    schema: S.boolean,
    prompt: {
      type: "confirm",
      message:
        "Should dependency to @ty-ras-extras be added to backend project?",
      default: true,
    },
    flag: {
      type: "boolean",
      isRequired: false,
      alias: "eb",
    },
    condition: hasBEComponent,
  },
  feMessage: {
    orderNumber: 7,
    message: (components) =>
      hasFEComponent(components)
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
  extrasInFrontend: {
    orderNumber: 9,
    schema: S.boolean,
    prompt: {
      type: "confirm",
      message:
        "Should dependency to @ty-ras-extras be added to frontend project?",
      default: true,
    },
    flag: {
      type: "boolean",
      isRequired: false,
      alias: "ef",
    },
    condition: hasFEComponent,
  },
} as const satisfies StagesGeneric;

const help = `
  Usage: npx ${
    (await readPkgUp.readPackageUp())?.packageJson.name
  } [options...] [folder]
`;

await main();

async function main() {
  const { flags, input } = meow(help, {
    importMeta: import.meta,
    flags: getFlags(),
    booleanDefault: undefined,
  });
  print(chalk.bold(gradient("\nTyRAS\n")));
  print(
    chalk.italic(
      "This program will create new template project to work with HTTP backend and/or client utilizing TyRAS libraries.\n",
    ),
  );
  const state: State = {
    flags,
    input,
    values: {},
  };
  const stagesAndNames = Object.entries(stages) as Array<[keyof Stages, Stage]>;
  stagesAndNames.sort((x, y) => x[1].orderNumber - y[1].orderNumber);
  for (const [stageName, stageInfo] of stagesAndNames) {
    await advanceStage(stageName, stageInfo, state);
  }
  print(`THE STATE:\n${JSON.stringify(state, undefined, 2)}`);
}

// eslint-disable-next-line sonarjs/cognitive-complexity
async function advanceStage(
  valueName: keyof Stages,
  stage: Stage,
  { flags, input, values }: State,
) {
  if ("message" in stage) {
    // Just print the message
    const messageToPrint =
      typeof stage.message === "string"
        ? stage.message
        : stage.message(getComponentsFromValues(values));
    if (messageToPrint !== undefined) {
      print(messageToPrint);
    }
  } else {
    const { prompt, schema, flag, condition } = stage;
    if (condition === undefined || condition(getComponentsFromValues(values))) {
      // Check if this is already supplied via flag or input arg
      let value = valueName !== "folderName" ? flags[valueName] : input[0];
      const decode = S.decode(schema);
      if (value !== undefined && !S.is(schema)(value)) {
        print(
          chalk.bold.cyanBright(
            `! The value specified as CLI ${
              flag ? `parameter "${valueName}"` : "argument"
            } was not valid, proceeding to prompt for it.`,
          ),
          "warn",
        );
        value = undefined;
      }
      if (value === undefined) {
        // Prompt from user
        value = (
          await inquirer.prompt<{
            question: StageValues;
          }>({
            ...prompt,
            name: "question",
            validate: (input) => {
              const result = decode(input);
              return S.isSuccess(result) || TF.formatErrors(result.left);
            },
          })
        ).question;
      } else {
        print(
          chalk.italic(
            `Using value supplied via CLI for "${valueName}" (${value}).`,
          ),
        );
      }
      // No idea why this gives error:
      // Type 'string | boolean' is not assignable to type 'undefined'.
      //   Type 'string' is not assignable to type 'undefined'.ts(2322)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      values[valueName as keyof typeof values] = value as any;
    }
  }
}

function getFlags(): Flags {
  return Object.fromEntries(
    Object.entries(stages as StagesGeneric)
      .filter(
        (tuple): tuple is [FlagKeys, Stage & { flag: AnyFlag }] =>
          "flag" in tuple[1],
      )
      .map(([key, { flag }]) => [key, flag] as const),
  ) as Flags;
}

interface CommonStage {
  orderNumber: number;
}

interface StateMutatingStage {
  prompt: DistinctQuestion;
  flag?: AnyFlag;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: S.Schema<any>;
  condition?: DynamicValue<boolean>;
}

interface MessageStage {
  message:
    | string
    // We cannot pass StateBuilder as argument, since then stages object would be circularly referencing itself.
    // But since all our dynamic messages depend on just be/fe/be-and-fe mode, we can pass that instead
    | DynamicValue<string | undefined>;
}

type Stage = CommonStage & (StateMutatingStage | MessageStage);

interface State {
  input: ReadonlyArray<string>;
  flags: Result<Flags>["flags"];
  values: StateBuilder;
}

type Stages = typeof stages;

type StagesGeneric = Record<string, Stage>;

type StateBuilder = Partial<{
  -readonly [P in SchemaKeys]: S.Infer<Stages[P]["schema"]>;
}>;

type Flags = {
  [P in FlagKeys]: Stages[P]["flag"];
};

type FlagKeys = {
  [P in keyof Stages]: Stages[P] extends { flag: AnyFlag } ? P : never;
}[keyof Stages];

type SchemaKeys = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  [P in keyof Stages]: Stages[P] extends { schema: S.Schema<infer _> }
    ? P
    : never;
}[keyof Stages];

type StageValues = S.Infer<Stages[SchemaKeys]["schema"]>;

type DynamicValue<T> =
  // We cannot pass StateBuilder as argument, since then stages object would be circularly referencing itself.
  // But since all our dynamic messages depend on just be/fe/be-and-fe mode, we can pass that instead
  (components: Components) => T;

type Components = S.Infer<typeof componentsSchema>;

function print(msg: string, level: "log" | "warn" | "error" = "log") {
  // eslint-disable-next-line no-console
  console[level](msg);
}

function hasBEComponent(components: Components) {
  return components !== "fe";
}

function hasFEComponent(components: Components) {
  return components !== "be";
}

function getComponentsFromValues(values: StateBuilder): Components {
  return (
    values["components"] ??
    doThrow(
      "Internal error: message printing demanded information about components, but that information is not yet available!",
    )
  );
}

// type StageKey = TupleIndices<typeof stages>;

// // From https://stackoverflow.com/questions/73919926/typescript-declare-type-of-index-of-tuple
// type TupleIndices<T extends readonly any[]> = Extract<
//   keyof T,
//   `${number}`
// > extends `${infer N extends number}`
//   ? N
//   : never;
function doThrow(message: string): never {
  throw new Error(message);
}
