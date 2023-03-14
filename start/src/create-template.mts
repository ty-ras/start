import * as F from "@effect/data/Function";
import * as O from "@effect/data/Option";
import * as R from "@effect/data/ReadonlyRecord";
import * as A from "@effect/data/ReadonlyArray";
import * as S from "@effect/schema";
import * as TF from "@effect/schema/formatter/Tree";
import * as collectInput from "./collect-input.mjs";

export const writeProject = (input: collectInput.InputFromCLIOrUser) =>
  F.pipe(input);

export const validateInput = (
  input: collectInput.InputFromCLIOrUser,
): Promise<Array<readonly [keyof collectInput.InputFromCLIOrUser, string]>> =>
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
              S.decode(collectInput.stages[valueName].schema as S.Schema<any>),
              async (result) =>
                S.isFailure(result)
                  ? O.some(TF.formatErrors(result.left))
                  : (await validators[valueName]?.(value as never)) ?? O.none(),
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
