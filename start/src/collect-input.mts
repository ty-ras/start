import chalk from "chalk";
import meow, { type AnyFlag, type Result } from "meow";
import inquirer, { type DistinctQuestion } from "inquirer";
import * as readPkgUp from "read-pkg-up";
import * as F from "@effect/data/Function";
import * as E from "@effect/data/Either";
import * as R from "@effect/data/ReadonlyRecord";
import * as A from "@effect/data/ReadonlyArray";
import * as N from "@effect/data/Number";
import * as O from "@effect/data/Option";
import * as Ord from "@effect/data/typeclass/Order";
import * as S from "@effect/schema";
import * as TF from "@effect/schema/formatter/Tree";
import * as Match from "@effect/match";
import * as common from "./common.mjs";

export const collectInputs = async (welcomeMessage: () => void) => {
  // F.pipe(
  //   meow(help, {
  //     importMeta: import.meta,
  //     flags: getFlags(),
  //     booleanDefault: undefined,
  //   }),
  //   ({ flags, input }): State => ({ flags, input, values: {} }),
  //   E.right,
  //   E.bindTo("state"),
  //   () =>
  //     F.pipe(
  //       stages,
  //       R.toEntries,
  //       (lel) => lel,
  //       A.sort(
  //         F.pipe(
  //           N.Order,
  //           Ord.contramap((stage) => stage.orderNumber),
  //         ),
  //       ),
  //     ),
  // );

  const { flags, input } = meow(help, {
    importMeta: import.meta,
    flags: getFlags(),
    booleanDefault: undefined,
    autoVersion: true,
    autoHelp: true,
  });
  // At this point, we have not exited due to --version or --help command
  welcomeMessage();
  const state: State = {
    flags,
    input,
    values: {},
  };
  const stagesAndNames = Object.entries(stages) as Array<[keyof Stages, Stage]>;
  stagesAndNames.sort((x, y) => x[1].orderNumber - y[1].orderNumber);
  for (const [stageName, stageInfo] of stagesAndNames) {
    await handleStage(stageName, stageInfo, state);
  }
  return state.values;
};

const handleStage = async (
  valueName: keyof Stages,
  stage: Stage,
  state: State,
) => {
  if ("message" in stage) {
    handleStageMessage(stage, state.values);
  } else {
    await O.getOrNull(handleStageStateMutation(valueName, stage, state));
  }
};

const handleStageMessage = (
  { message }: MessageStage,
  values: StateBuilder,
): O.Option<void> =>
  F.pipe(
    // Start pattern matching on message
    Match.value(message),
    // If message is plain string, then use it as-is
    Match.when(Match.string, F.identity),
    // Otherwise, message is a function -> invoke it to get the actual message
    Match.orElse((message) => message(getComponentsFromValues(values))),
    // Wrap the result of pattern match (string | undefined) to perform another match
    Match.value,
    // If not undefined -> print the message as side-effect
    Match.not(Match.undefined, (str) => common.print(str)),
    // Finalize 2nd matching, otherwise it will never get executed
    Match.option,
  );

const handleStageStateMutation = (
  valueName: keyof Stages,
  { condition, schema, flag, prompt }: StateMutatingStage,
  { flags, input, values }: State,
) => {
  return F.pipe(
    // Match the condition
    Match.value(condition),
    // If condition is not specified, then it is interpreted as true
    Match.when(Match.undefined, F.constTrue),
    // Otherwise, condition is a function -> invoke it to get the actual boolean value
    Match.orElse((condition) => condition(getComponentsFromValues(values))),
    // Start new pattern matching, which will perform the actual state mutation
    Match.value,
    // If the condition pattern match evaluated to true, proceed
    Match.when(true, () =>
      F.pipe(
        // Match the value either from flags, or from unnamed CLI args
        Match.value(valueName in flags ? flags[valueName] : input[0]),
        // If value was specified, but didn't match the schema...
        Match.when(
          (value) => value !== undefined && !S.is(schema)(value),
          () => {
            // Side-effect: notify that value specified via CLI arg was not valid
            common.print(
              chalk.bold.cyanBright(
                `! The value specified as CLI ${
                  flag ? `parameter "${valueName}"` : "argument"
                } was not valid, proceeding to prompt for it.`,
              ),
              "warn",
            );
            // Continue as if value was not set
            undefined;
          },
        ),
        // Break out of current pattern matching by using value as-is
        Match.orElse(F.identity),
        // Start next pattern matching
        Match.value,
        // When value is not set (= undefined)...
        Match.when(Match.undefined, () =>
          F.pipe(
            // Construct schema decoder
            S.decode(schema),
            // Prompt the value from user, using schema decoder as validator
            async (decode) =>
              (
                await inquirer.prompt<{
                  question: StageValues;
                }>({
                  ...prompt,
                  name: "question",
                  validate: (input) =>
                    // We could use F.flow here, but the signature of decode is not compatible with validate
                    F.pipe(
                      input,
                      // Use decoder to validate input
                      decode,
                      // On success, just return true
                      E.map(constTrue),
                      // On error, return string with nicely formatted error message
                      E.getOrElse(TF.formatErrors),
                    ),
                })
              ).question,
          ),
        ),
        Match.orElse((value) => {
          // Side-effect: notify user that instead of prompting, the value from CLI will be used
          common.print(
            chalk.italic(
              `Using value supplied via CLI for "${valueName}" (${value}).`,
            ),
          );
          // Use the value as-is
          return Promise.resolve(value);
        }),
        async (asyncValue) => {
          // Side-effect: mutate state with the final, validated, value got either as CLI argument or as user input
          // No idea why this gives error:
          // Type 'string | boolean' is not assignable to type 'undefined'.
          //   Type 'string' is not assignable to type 'undefined'.ts(2322)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return
          values[valueName as keyof typeof values] =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (await asyncValue) as any;
        },
      ),
    ),
    Match.option,
  );
  // if (condition === undefined || condition(getComponentsFromValues(values))) {
  //   // Check if this is already supplied via flag or input arg
  //   let value = valueName in flags ? flags[valueName] : input[0];
  //   if (value !== undefined && !S.is(schema)(value)) {
  //     common.print(
  //       chalk.bold.cyanBright(
  //         `! The value specified as CLI ${
  //           flag ? `parameter "${valueName}"` : "argument"
  //         } was not valid, proceeding to prompt for it.`,
  //       ),
  //       "warn",
  //     );
  //     value = undefined;
  //   }
  //   if (value === undefined) {
  //     const decode = S.decode(schema);
  //     // Prompt from user
  //     value = (
  //       await inquirer.prompt<{
  //         question: StageValues;
  //       }>({
  //         ...prompt,
  //         name: "question",
  //         validate: (input) => {
  //           const result = decode(input);
  //           return S.isSuccess(result) || TF.formatErrors(result.left);
  //         },
  //       })
  //     ).question;
  //   } else {
  //     common.print(
  //       chalk.italic(
  //         `Using value supplied via CLI for "${valueName}" (${value}).`,
  //       ),
  //     );
  //   }
  //   values[valueName as keyof typeof values] = value as any;
  // }
};

const getFlags = (): Flags => {
  return Object.fromEntries(
    Object.entries(stages as StagesGeneric)
      .filter(
        (tuple): tuple is [FlagKeys, Stage & { flag: AnyFlag }] =>
          "flag" in tuple[1],
      )
      .map(([key, { flag }]) => [key, flag] as const),
  ) as Flags;
};

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

const hasBEComponent = (components: Components) => components !== "fe";

const hasFEComponent = (components: Components) => components !== "be";

const getComponentsFromValues = (values: StateBuilder): Components =>
  values["components"] ??
  doThrow(
    "Internal error: message printing demanded information about components, but that information is not yet available!",
  );

const doThrow = (message: string) => {
  throw new Error(message);
};

// const callFunctionWithArguments =
//   <TFunc extends (...args: any[]) => any>(
//     args: F.LazyArg<Parameters<TFunc>>,
//   ): ((func: TFunc) => ReturnType<TFunc>) =>
//   (func) =>
//     // eslint-disable-next-line @typescript-eslint/no-unsafe-return
//     func(...args());

const constTrue: F.LazyArg<true> = () => true;

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

const stagesOrdered = F.pipe(
  stages,
  R.toEntries,
  (lel) => lel,
  A.sort(
    F.pipe(
      N.Order,
      Ord.contramap((stage: [string, Stage]) => stage[1].orderNumber),
    ),
  ),
);
