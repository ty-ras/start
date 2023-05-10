import * as F from "@effect/data/Function";
import * as S from "@effect/schema/Schema";

export default F.pipe(
  S.record(S.string, S.unknown),
  S.extend(
    S.struct({
      dependencies: S.record(S.string, S.string),
      devDependencies: S.record(S.string, S.string),
    }),
  ),
);
