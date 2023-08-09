import * as F from "@effect/data/Function";
import * as S from "@effect/schema/Schema";

const packageJson = F.pipe(
  S.record(S.string, S.unknown),
  S.extend(
    S.struct({
      name: S.string,
      dependencies: S.record(S.string, S.string),
      devDependencies: S.record(S.string, S.string),
    }),
  ),
);

export default packageJson;

export type PackageDependencies = S.To<typeof packageJson>["dependencies"];
