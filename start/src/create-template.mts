import * as F from "@effect/data/Function";
import * as O from "@effect/data/Option";
import * as E from "@effect/data/Either";
import * as A from "@effect/data/ReadonlyArray";
import * as S from "@effect/schema";
import * as TF from "@effect/schema/formatter/Tree";
import * as Match from "@effect/match";
import * as collectInput from "./collect-input.mjs";
import * as fs from "node:fs/promises";

export const writeProjectFiles = (input: Input) => F.pipe(input);

export const validateInput = (
  input: collectInput.InputFromCLIOrUser,
):
  | string
  | Promise<
      Input | Array<readonly [keyof collectInput.InputFromCLIOrUser, string]>
    > =>
  F.pipe(
    input,
    inputSchemaDecoder,
    E.mapLeft(TF.formatErrors),
    Match.value,
    Match.when(E.isLeft, ({ left }) => left),
    Match.orElse(({ right: validatedInput }) =>
      invokeValidators(validatedInput),
    ),
  );

const invokeValidators = (input: Readonly<Input>) =>
  F.pipe(
    Object.entries(input) as ReadonlyArray<
      [keyof Input, Exclude<Input[keyof Input], undefined>]
    >,
    (entries) =>
      entries.map(
        async ([valueName, value]) =>
          [
            valueName,
            await F.pipe(
              value,
              S.decode(collectInput.stages[valueName].schema as S.Schema<any>),
              async (result) => {
                try {
                  return S.isFailure(result)
                    ? O.some(TF.formatErrors(result.left))
                    : (await validators[valueName]?.(value as never)) ??
                        O.none();
                } catch (err) {
                  return O.some(
                    err instanceof Error
                      ? `${err.name}: ${err.message}`
                      : `${err}`,
                  );
                }
              },
            ),
          ] as const,
      ),
    async (promises) =>
      F.pipe(
        await Promise.all(promises),
        A.filterMap(([valueName, validationResult]) =>
          F.pipe(
            validationResult,
            O.map((errorMessage) => [valueName, errorMessage] as const),
          ),
        ),
      ),
    async (validationErrors) =>
      (await validationErrors).length > 0 ? validationErrors : input,
  );

const validators: Partial<{
  [P in keyof Input]: (
    value: Exclude<Input[P], undefined>,
  ) => Promise<O.Option<string>>;
}> = {
  folderName: async (folderName) => {
    await fs.mkdir(folderName, { recursive: true });
    return (await fs.readdir(folderName)).length > 0
      ? O.some("Target directory not empty!")
      : O.none();
  },
};

const pickSchemas = <TKeys extends Array<collectInput.SchemaKeys>>(
  ...keys: TKeys
): { [P in TKeys[number]]: collectInput.Stages[P]["schema"] } =>
  Object.fromEntries(
    Object.entries(collectInput.stages)
      .filter(
        (
          entry,
        ): entry is [
          collectInput.SchemaKeys,
          collectInput.Stages[collectInput.SchemaKeys],
        ] => keys.indexOf(entry[0] as collectInput.SchemaKeys) >= 0,
      )
      .map(([key, stage]) => [key, stage.schema] as const),
  ) as { [P in TKeys[number]]: collectInput.Stages[P]["schema"] };

// No intersections yet in @effect/schema I think...
const inputSchema = F.pipe(
  F.pipe(
    S.struct(pickSchemas("folderName", "components", "dataValidation")),
    S.identifier("GeneralProperties"),
  ),
  S.extend(
    S.union(
      F.pipe(
        S.struct(
          pickSchemas(
            // FE properties
            "client",
            "extrasInFrontend",
          ),
        ),
        S.identifier("FrontendProperties"),
      ),
      F.pipe(
        S.struct(
          pickSchemas(
            // BE properties
            "server",
            "extrasInBackend",
          ),
        ),
        S.identifier("BackendProperties"),
      ),
      F.pipe(
        S.struct(
          pickSchemas(
            // FE properties
            "client",
            "extrasInFrontend",
            // BE properties
            "server",
            "extrasInBackend",
          ),
        ),
        S.identifier("BackendProperties"),
      ),
    ),
  ),
);

const inputSchemaDecoder = S.decode(inputSchema);

export type Input = S.Infer<typeof inputSchema>;
