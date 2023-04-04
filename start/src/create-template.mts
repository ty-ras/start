import * as F from "@effect/data/Function";
import * as O from "@effect/data/Option";
import * as E from "@effect/data/Either";
import * as A from "@effect/data/ReadonlyArray";
import * as S from "@effect/schema/Schema";
import * as TF from "@effect/schema/TreeFormatter";
import * as Match from "@effect/match";
import * as collectInput from "./collect-input.mjs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as fse from "fs-extra";

export const writeProjectFiles = async ({
  folderName,
  dataValidation,
  components,
}: Input) => {
  await fse.copy(
    path.join(
      new URL(import.meta.url).pathname,
      "..",
      "..",
      "templates",
      dataValidation,
      components,
    ),
    folderName,
  );
};

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
    E.mapLeft(({ errors }) => TF.formatErrors(errors)),
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
              S.decodeEither(
                collectInput.stages[valueName].schema as S.Schema<any>,
              ),
              async (result) => {
                try {
                  return E.isLeft(result)
                    ? O.some(TF.formatErrors(result.left.errors))
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
            // "extrasInFrontend",
          ),
        ),
        S.identifier("FrontendProperties"),
      ),
      F.pipe(
        S.struct(
          pickSchemas(
            // BE properties
            "server",
            // "extrasInBackend",
          ),
        ),
        S.identifier("BackendProperties"),
      ),
      F.pipe(
        S.struct(
          pickSchemas(
            // FE properties
            "client",
            // "extrasInFrontend",
            // BE properties
            "server",
            // "extrasInBackend",
          ),
        ),
        S.identifier("BackendAndFrontendProperties"),
      ),
    ),
  ),
);

// We must use parseEither instead of decodeEither
// This is because parseEither always takes unknown as input parameter
// The decodeEither takes schema input type as input parameter -> in this case, it will be something else than unknown
const inputSchemaDecoder = S.parseEither(inputSchema);

export type Input = S.To<typeof inputSchema>;
