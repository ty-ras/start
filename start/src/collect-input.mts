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
import * as Set from "@effect/data/HashSet";
import * as Ord from "@effect/data/typeclass/Order";
import * as S from "@effect/schema";
import * as TF from "@effect/schema/formatter/Tree";
import * as Match from "@effect/match";
import * as common from "./common.mjs";

export const createCLIArgs = (): CLIArgs => {
  const { flags, input } = meow(help, {
    importMeta: import.meta,
    flags: getFlags(),
    booleanDefault: undefined,
    autoVersion: true,
    autoHelp: true,
  });
  return { flags, input };
};

export const collectInputs = async (
  cliArgs: CLIArgsInfo,
  values: InputFromCLIOrUser,
): Promise<Set.HashSet<CLIArgsInfoSetElement>> => {
  let components: O.Option<Components> = O.fromNullable(values["components"]);
  let cliArgsSet = Set.make<ReadonlyArray<CLIArgsInfoSetElement>>();
  for (const [stageName, stageInfo] of stagesOrdered) {
    if (!(stageName in values)) {
      F.pipe(
        Match.value(
          O.fromNullable(
            await handleStage(stageName, stageInfo, cliArgs, components),
          ),
        ),
        Match.when(O.isSome, ({ value: { value, fromCLI } }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          values[stageName as keyof typeof values] =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value as any;
          if (stageName === "components") {
            components = O.some(value as Components);
          }
          if (fromCLI) {
            cliArgsSet = Set.add(
              cliArgsSet,
              stageName as CLIArgsInfoSetElement,
            );
          }
        }),
        // End pattern matching
        Match.option,
      );
    }
  }
  return cliArgsSet;
};

const handleStage = (
  valueName: keyof Stages,
  stage: Stage,
  cliArgs: CLIArgsInfo,
  components: O.Option<Components>,
) =>
  F.pipe(
    Match.value(stage),
    Match.when(
      (stage): stage is MessageStage & CommonStage => "message" in stage,
      (stage): O.Option<Promise<StageHandlingResult>> =>
        handleStageMessage(stage, components),
    ),
    Match.orElse(
      (stage): O.Option<Promise<StageHandlingResult>> =>
        handleStageStateMutation(valueName, stage, cliArgs, components),
    ),
    O.getOrNull,
  );

const handleStageMessage = (
  { message }: MessageStage,
  components: O.Option<Components>,
): O.Option<Promise<StageHandlingResult>> =>
  F.pipe(
    // Start pattern matching on message
    Match.value(message),
    // If message is plain string, then use it as-is
    Match.when(Match.string, F.identity),
    // Otherwise, message is a function -> invoke it to get the actual message
    Match.orElse((message) => message(O.getOrThrow(components))),
    // Wrap the result of pattern match (string | undefined) to perform another match
    Match.value,
    // If not undefined -> print the message as side-effect
    Match.not(Match.undefined, (str) => common.print(str)),
    // Finalize 2nd matching, otherwise it will never get executed
    Match.option,
    O.none,
  );

// The asyncness here is not handled particularly nicely
// I'm not quite sure how @effect -umbrella libs will handle that eventually.
// FP-TS had Tasks, but @effect seems to lack those, and use the fiber-based Effect thingy.
// I guess that works too, but pairing that with newer stuff like pattern matching etc doesn't seem to be quite intuitive at least.
const handleStageStateMutation = (
  valueName: keyof Stages,
  { condition, schema, flag, prompt }: StateMutatingStage,
  cliArgs: CLIArgsInfo,
  components: O.Option<Components>,
): O.Option<Promise<StageHandlingResult>> => {
  return F.pipe(
    // Match the condition
    Match.value(condition),
    // If condition is not specified, then it is interpreted as true
    Match.when(Match.undefined, F.constTrue),
    // Otherwise, condition is a function -> invoke it to get the actual boolean value
    Match.orElse((condition) => condition(O.getOrThrow(components))),
    // Start new pattern matching, which will perform the actual state mutation
    Match.value,
    // If the condition pattern match evaluated to true, proceed
    Match.when(true, () =>
      F.pipe(
        // Try to get the value from CLI flags or args
        getValueFromCLIFlagsOrArgs(valueName, schema, flag, cliArgs),
        // Start next pattern matching
        Match.value,
        // When value is not set, or is invalid (= undefined), then prompt value from user
        Match.when(O.isNone, async () => ({
          value: await promptValueFromUser(schema, prompt),
          fromCLI: false,
        })),
        // If valid value was in CLI flags or args, use it as-is
        Match.orElse(({ value }) => Promise.resolve({ value, fromCLI: true })),
      ),
    ),
    // End matching
    Match.option,
  );
};

const getValueFromCLIFlagsOrArgs = (
  valueName: keyof Stages,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: S.Schema<any>,
  flag: AnyFlag | undefined,
  cliArgs: CLIArgsInfo,
): O.Option<StageValues> =>
  F.pipe(
    Match.value(cliArgs),
    Match.when(Set.isHashSet, (cliArgsNames) => {
      if (Set.has(cliArgsNames, valueName)) {
        // The value was specified via CLI, but failed more advanced validation
        common.print(
          chalk.bold.cyanBright(
            `Not re-using CLI-supplied value for "${valueName}" after error.`,
          ),
        );
      }
      return O.none<StageValues | undefined>();
    }),
    Match.orElse(({ flags, input }) =>
      F.pipe(
        // Match the value either from flags, or from unnamed CLI args
        Match.value<StageValues>(
          ("flag" in stages[valueName]
            ? flags[valueName]
            : input[0]) as StageValues,
        ),
        // If value was specified (is not undefined)
        Match.not(Match.undefined, (value) =>
          F.pipe(
            // Is the value adhering to the schema?
            Match.value(S.is(schema)(value)),
            // If value adhers to schema, we can use it.
            // Notify user about this.
            Match.when(true, () => {
              // Side-effect: notify user that instead of prompting, the value from CLI will be used
              common.print(
                chalk.italic(
                  `Using value supplied via CLI for "${valueName}" (${value}).`,
                ),
              );
              return value;
            }),
            // If value does not adher to schema, we should not use it.
            // Notify user about this.
            Match.orElse(() => {
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
              return undefined;
            }),
          ),
        ),
        Match.option,
      ),
    ),
    // At this point we have O.Option<StageValues | undefined>
    // And we want to end up with O.Option<StageValues>
    // So we need to do a little dancing with O.Options (especially since at least for now there is no .chain for any of @effect/data structures.)
    O.map(O.fromNullable),
    O.flatten,
  );

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const promptValueFromUser = (schema: S.Schema<any>, prompt: DistinctQuestion) =>
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
  );

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

interface CLIArgs {
  input: ReadonlyArray<string>;
  flags: Partial<Result<Flags>["flags"]>;
}

export type CLIArgsInfo = CLIArgs | Set.HashSet<CLIArgsInfoSetElement>;

export type CLIArgsInfoSetElement = FlagKeys | CLIInputsKey;

export type Stages = typeof stages;

type StagesGeneric = Record<string, Stage>;

export type InputFromCLIOrUser = Partial<{
  -readonly [P in SchemaKeys]: S.Infer<Stages[P]["schema"]>;
}>;

type Flags = {
  [P in FlagKeys]: Stages[P]["flag"];
};

type FlagKeys = {
  [P in keyof Stages]: Stages[P] extends { flag: AnyFlag } ? P : never;
}[keyof Stages];

type CLIInputsKey = {
  [P in keyof Stages]: Stages[P] extends {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    schema: S.Schema<infer _>;
    flag?: never;
  }
    ? P
    : never;
}[keyof Stages];

export type SchemaKeys = {
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

type StageHandlingResult = { value: StageValues; fromCLI: boolean };

const hasBEComponent = (components: Components) => components !== "fe";

const hasFEComponent = (components: Components) => components !== "be";

// The constTrue in @effect/data/Function is of type F.LazyArg<boolean> while here we need F.LazyArg<true>
const constTrue: F.LazyArg<true> = () => true;

const componentsSchema = S.keyof(
  S.struct({ be: S.any, fe: S.any, ["be-and-fe"]: S.any }),
);

export const stages = {
  generalMessage: {
    orderNumber: 0,
    message: chalk.bold.bgBlueBright("# General project configuration"),
  },
  folderName: {
    orderNumber: 1,
    schema: F.pipe(
      S.string,
      S.nonEmpty({ title: "Folder as non-empty string." }),
      // Looks like validating paths is not so easy task, so for now this simple check is fine
    ),
    prompt: {
      type: "input",
      message: "Where should the project be created?",
      default: "./my-project",
    },
  },
  components: {
    orderNumber: 2,
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
    orderNumber: 3,
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

// TODO for proper help text, we need to use flag names as constants.
// OR iterate "stages" to pick only those with 'flag' and generate help string from that
// Also remember to include the input arg stage.
const help = `
  Usage: npx ${
    (await readPkgUp.readPackageUp())?.packageJson.name
  } [options...] [folder]
`;

const stagesOrdered = F.pipe(
  stages,
  R.toEntries,
  A.sort(
    F.pipe(
      N.Order,
      Ord.contramap((stage: [string, Stage]) => stage[1].orderNumber),
    ),
  ),
);
