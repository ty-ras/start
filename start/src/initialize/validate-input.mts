import type * as inputSpec from "./input-spec.mjs";
// Currently, we don't do any additional validation, so simply return value as-is
export default (input: inputSpec.InputFromCLIOrUser): Promise<ValidatedInput> =>
  Promise.resolve(input);

export type ValidatedInput = Readonly<inputSpec.InputFromCLIOrUser>;
