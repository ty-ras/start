import * as F from "@effect/data/Function";
import * as O from "@effect/data/Option";
import * as E from "@effect/data/Either";
import * as A from "@effect/data/ReadonlyArray";
import * as S from "@effect/schema";
import * as TF from "@effect/schema/formatter/Tree";
import * as Match from "@effect/match";
import * as collectInput from "./collect-input.mjs";

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
      F.pipe(
        Object.entries(input) as ReadonlyArray<
          [
            keyof collectInput.InputFromCLIOrUser,
            Exclude<
              collectInput.InputFromCLIOrUser[keyof collectInput.InputFromCLIOrUser],
              undefined
            >,
          ]
        >,
        (entries) =>
          entries.map(
            async ([valueName, value]) =>
              [
                valueName,
                await F.pipe(
                  value,
                  S.decode(
                    collectInput.stages[valueName].schema as S.Schema<any>,
                  ),
                  async (result) =>
                    S.isFailure(result)
                      ? O.some(TF.formatErrors(result.left))
                      : (await validators[valueName]?.(value as never)) ??
                        O.none(),
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
          (await validationErrors).length > 0
            ? validationErrors
            : validatedInput,
      ),
    ),
  );

const validators: {
  [P in keyof collectInput.InputFromCLIOrUser]: (
    value: Exclude<collectInput.InputFromCLIOrUser[P], undefined>,
  ) => Promise<O.Option<string>>;
} = {
  folderName: (folderName) =>
    Promise.resolve(
      O.some("TODO check that target folder either does not exist or is empty"),
    ),
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
