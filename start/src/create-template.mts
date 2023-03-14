import * as F from "@effect/data/Function";
import * as S from "@effect/schema";
import type * as collectInput from "./collect-input.mjs";

export const writeProject = (input: collectInput.InputFromCLIOrUser) =>
  F.pipe(input, validateInput);

const validateInput = F.pipe(
  S.extend(
    S.struct({
      folderName: S.string,
      components: S.keyof(S.struct({ be: S.any })),
      dataValidation: S.keyof(S.struct({ ["io-ts"]: S.any })),
    }),
  )(
    S.union(
      S.struct({
        client: S.keyof(S.struct({ fetch: S.any })),
        extrasInFrontend: S.boolean,
      }),
      S.struct({
        server: S.keyof(S.struct({ node: S.any })),
        extrasInBackend: S.boolean,
      }),
    ),
  ),
  S.decode,
);
