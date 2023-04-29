import chalk from "chalk";
import { type AnyFlag } from "meow";
import inquirer, { type DistinctQuestion } from "inquirer";
import * as F from "@effect/data/Function";
import * as E from "@effect/data/Either";
import * as R from "@effect/data/ReadonlyRecord";
import * as A from "@effect/data/ReadonlyArray";
import * as N from "@effect/data/Number";
import * as O from "@effect/data/Option";
import * as Set from "@effect/data/HashSet";
import * as Ord from "@effect/data/typeclass/Order";
import * as S from "@effect/schema/Schema";
import * as TF from "@effect/schema/TreeFormatter";
import * as Match from "@effect/match";
import print from "./print.mjs";
import type * as cliArgs from "./cli-args.mjs";
import stages, {
  type Components,
  type Stage,
  type Stages,
  type MessageStage,
  type CommonStage,
  type StateMutatingStage,
} from "./stages.mjs";

export default async (
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
    Match.not(Match.undefined, (str) => print(str)),
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
    Match.orElse(({ isApplicable }) => isApplicable(O.getOrThrow(components))),
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
        print(
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
              print(
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
              print(
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
    S.decodeEither(schema),
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
              E.getOrElse(({ errors }) => TF.formatErrors(errors)),
            ),
        })
      ).question,
  );

// The constTrue in @effect/data/Function is of type F.LazyArg<boolean> while here we need F.LazyArg<true>
const constTrue: F.LazyArg<true> = () => true;

export type InputFromCLIOrUser = Partial<{
  -readonly [P in SchemaKeys]: S.To<Stages[P]["schema"]>;
}>;

export type CLIArgsInfo = cliArgs.CLIArgs | Set.HashSet<CLIArgsInfoSetElement>;

export type CLIArgsInfoSetElement = cliArgs.FlagKeys | CLIInputsKey;

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
  [P in keyof Stages]: Stages[P] extends {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    schema: S.Schema<infer _>;
  }
    ? P
    : never;
}[keyof Stages];

type StageHandlingResult = { value: StageValues; fromCLI: boolean };

type StageValues = S.To<Stages[SchemaKeys]["schema"]>;
