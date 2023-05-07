/* eslint-disable @typescript-eslint/no-unused-vars */
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
import * as cliArgs from "./cli-args.mjs";
import type * as stages from "./stages";

export default <TStages extends stages.StagesBase>(
    stages: TStages,
  ): (<TValidatedInput>(
    cliArgs: CLIArgsInfo<TStages>,
    dynamicValueInputKey: keyof InputFromCLIOrUser<TStages>,
    inputValidator: InputValidator<TStages, TValidatedInput>,
  ) => Promise<TValidatedInput>) =>
  async (cliArgs, dynamicValueInputKey, inputValidator) => {
    // Then, collect the inputs - use CLI args or prompt from user
    // Keep collecting until all inputs pass validation
    let input: InputFromCLIOrUser<TStages> = {};
    let validatedInput: GetValidatedInput<typeof inputValidator> | undefined;
    do {
      // Get the inputs from CLI args or user prompt
      // On first loop, the 'input' will be empty and all the things will be checked/asked.
      // On subsequent loops (if any), only the errored properties will be missing, and thus checked/asked again.
      const cliArgsSet: Set.HashSet<CLIArgsInfoSetElement<TStages>> =
        await collectInput(stages, cliArgs, input, dynamicValueInputKey);
      // Validate the inputs in a way that template creation part knows
      const validationResult = await inputValidator(input);
      if (Array.isArray(validationResult)) {
        // When there are errors, notify user and adjust 'input' variable.
        for (const [valueName, errorMessage] of validationResult) {
          // Notify user about the error
          print(
            chalk.redBright(
              `Error for "${String(valueName)}":\n${errorMessage}\n`,
            ),
          );
          // Delete it so that collectInputs would ask for it again
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          delete (input as any)[valueName];
        }
        if (!Set.isHashSet(cliArgs)) {
          cliArgs = cliArgsSet;
        }
      } else if (typeof validationResult === "string") {
        // This signifies internal error, as at this point the input itself is structurally invalid
        // Clear everything and start asking from clean slate
        print(
          chalk.red(
            `There has been an internal error when collecting input.\nIgnoring all CLI flags from now on, and starting to collect input from beginning.\nError message: ${validationResult}`,
          ),
        );
        cliArgs = { flags: {}, input: [] };
        input = {};
      } else {
        validatedInput = validationResult;
      }
    } while (validatedInput === undefined);
    return validatedInput;
  };

export type InputValidator<
  TStages extends stages.StagesBase,
  TValidatedInput,
> = (
  input: InputFromCLIOrUser<TStages>,
) =>
  | string
  | Promise<
      | TValidatedInput
      | Array<readonly [keyof InputFromCLIOrUser<TStages>, string]>
    >;

const collectInput = async <TStages extends stages.StagesBase>(
  stages: TStages,
  cliArgs: CLIArgsInfo<TStages>,
  values: InputFromCLIOrUser<TStages>,
  dynamicValueInputKey: keyof InputFromCLIOrUser<TStages>,
): Promise<Set.HashSet<CLIArgsInfoSetElement<TStages>>> => {
  let components: O.Option<stages.GetDynamicValueInput<TStages>> =
    O.fromNullable(values[dynamicValueInputKey]);
  let cliArgsSet = Set.make<ReadonlyArray<CLIArgsInfoSetElement<TStages>>>();
  for (const [stageName, stageInfo] of getStagesOrdered(stages)) {
    if (!(stageName in values)) {
      F.pipe(
        Match.value(
          O.fromNullable(
            await handleStage(stageName, stageInfo, cliArgs, components),
          ),
        ),
        Match.when(O.isSome, ({ value: { value, fromCLI } }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          values[stageName as keyof typeof values] = value;
          if (stageName === dynamicValueInputKey) {
            components = O.some(value as stages.GetDynamicValueInput<TStages>);
          }
          if (fromCLI) {
            cliArgsSet = Set.add(
              cliArgsSet,
              stageName as CLIArgsInfoSetElement<TStages>,
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

const getStagesOrdered = <TStages extends stages.StagesBase>(stages: TStages) =>
  F.pipe(
    stages,
    R.toEntries,
    A.sort(
      F.pipe(
        N.Order,
        Ord.contramap(
          (
            stage: [string, stages.Stage<stages.GetDynamicValueInput<TStages>>],
          ) => stage[1].orderNumber,
        ),
      ),
    ),
  );

const handleStage = <TStages extends stages.StagesBase>(
  valueName: keyof TStages,
  stage: stages.Stage<stages.GetDynamicValueInput<TStages>>,
  cliArgs: CLIArgsInfo<TStages>,
  components: O.Option<stages.GetDynamicValueInput<TStages>>,
) =>
  F.pipe(
    Match.value(stage),
    Match.when(
      (
        stage,
      ): stage is stages.MessageStage<stages.GetDynamicValueInput<TStages>> &
        stages.CommonStage => "message" in stage,
      (stage): O.Option<Promise<StageHandlingResult<TStages>>> =>
        handleStageMessage(stage, components),
    ),
    Match.orElse(
      (stage): O.Option<Promise<StageHandlingResult<TStages>>> =>
        handleStageStateMutation(valueName, stage, cliArgs, components),
    ),
    O.getOrNull,
  );

const handleStageMessage = <TStages extends stages.StagesBase>(
  { message }: stages.MessageStage<stages.GetDynamicValueInput<TStages>>,
  components: O.Option<stages.GetDynamicValueInput<TStages>>,
): O.Option<Promise<StageHandlingResult<TStages>>> =>
  F.pipe(
    // Start pattern matching on message
    Match.value(message),
    // If message is plain string, then use it as-is
    Match.when(Match.string, F.identity),
    // Otherwise, message is a function -> invoke it to get the actual message
    Match.orElse((message) => message(O.getOrThrow(components))),
    // Wrap the result of pattern match (string | undefined) to perform another match
    Match.value,
    // If string -> print the message as side-effect
    Match.when(Match.string, (str) => print(str)),
    // Finalize 2nd matching, otherwise it will never get executed
    Match.option,
    O.none,
  );

// The asyncness here is not handled particularly nicely
// I'm not quite sure how @effect -umbrella libs will handle that eventually.
// FP-TS had Tasks, but @effect seems to lack those, and use the fiber-based Effect thingy.
// I guess that works too, but pairing that with newer stuff like pattern matching etc doesn't seem to be quite intuitive at least.
const handleStageStateMutation = <TStages extends stages.StagesBase>(
  valueName: keyof TStages,
  {
    condition,
    schema,
    flag,
    prompt,
  }: stages.StateMutatingStage<stages.GetDynamicValueInput<TStages>>,
  cliArgs: CLIArgsInfo<TStages>,
  components: O.Option<stages.GetDynamicValueInput<TStages>>,
): O.Option<Promise<StageHandlingResult<TStages>>> => {
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
        getValueFromCLIFlagsOrArgs(String(valueName), schema, flag, cliArgs),
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

const getValueFromCLIFlagsOrArgs = <TStages extends stages.StagesBase>(
  valueName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: S.Schema<any>,
  flag: AnyFlag | undefined,
  cliArgs: CLIArgsInfo<TStages>,
): O.Option<StageValues<TStages>> =>
  F.pipe(
    Match.value(cliArgs),
    Match.when(
      Set.isHashSet,
      (cliArgsNames: Set.HashSet<CLIArgsInfoSetElement<TStages>>) => {
        if (
          Set.has(cliArgsNames, valueName as CLIArgsInfoSetElement<TStages>)
        ) {
          // The value was specified via CLI, but failed more advanced validation
          print(
            chalk.bold.cyanBright(
              `Not re-using CLI-supplied value for "${valueName}" after error.`,
            ),
          );
        }
        return O.none<StageValues<TStages> | undefined>();
      },
    ),
    Match.orElse<
      cliArgs.CLIArgs<TStages>,
      O.Option<StageValues<TStages> | undefined>
    >(({ flags, input }) =>
      F.pipe(
        // Match the value either from flags, or from unnamed CLI args
        Match.value<StageValues<TStages> | undefined>(
          flag ? flags[valueName as keyof typeof flags] : input[0],
        ),
        // If value was specified (is not undefined)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Match.not(Match.undefined, (value: any) =>
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
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return
              return value as StageValues<TStages>;
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
        (matcher): O.Option<StageValues<TStages> | undefined> =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
          Match.option(matcher) as any,
      ),
    ),
    // At this point we have O.Option<StageValues | undefined>
    // And we want to end up with O.Option<StageValues>
    // So we need to do a little dancing with O.Options (especially since at least for now there is no .chain for any of @effect/data structures.)
    O.map(O.fromNullable),
    O.flatten,
  );

const promptValueFromUser = <TStages extends stages.StagesBase>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: S.Schema<any>,
  prompt: DistinctQuestion,
) =>
  F.pipe(
    // Construct schema decoder
    S.decodeEither(schema),
    // Prompt the value from user, using schema decoder as validator
    async (decode) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (
        await inquirer.prompt<{
          question: StageValues<TStages>;
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

export type InputFromCLIOrUser<TStages extends stages.StagesBase> = Partial<{
  -readonly [P in SchemaKeys<TStages>]: TStages[P] extends stages.StateMutatingStage<
    infer _
  >
    ? S.To<TStages[P]["schema"]>
    : never;
}>;

export type CLIArgsInfo<TStages extends stages.StagesBase> =
  | cliArgs.CLIArgs<TStages>
  | Set.HashSet<CLIArgsInfoSetElement<TStages>>;

export type CLIArgsInfoSetElement<TStages extends stages.StagesBase> =
  | cliArgs.FlagKeys<TStages>
  | CLIInputsKey<TStages>;

export type CLIInputsKey<TStages extends stages.StagesBase> = {
  [P in keyof TStages]: TStages[P] extends {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    schema: S.Schema<infer _>;
    flag?: never;
  }
    ? P
    : never;
}[keyof TStages];

export type SchemaKeys<TStages extends stages.StagesBase> = {
  [P in keyof TStages]: TStages[P] extends stages.StateMutatingStage<infer _>
    ? P
    : never;
}[keyof TStages];

type StageHandlingResult<TStages extends stages.StagesBase> = {
  value: StageValues<TStages>;
  fromCLI: boolean;
};

type SchemasOfStages<TStages extends stages.StagesBase> = {
  [P in keyof TStages]: TStages[P] extends stages.StateMutatingStage<infer _>
    ? TStages[P]["schema"]
    : never;
}[keyof TStages];

type StageValues<TStages extends stages.StagesBase> = S.To<
  SchemasOfStages<TStages>
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GetValidatedInput<TValidator extends InputValidator<any, any>> =
  TValidator extends InputValidator<infer _, infer TValidatedInput>
    ? TValidatedInput
    : never;
