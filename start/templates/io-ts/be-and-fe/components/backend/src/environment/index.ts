import type { taskEither as TE } from "fp-ts";

export interface Environment<TOutput> {
  tokenVerifier: TokenVerifier<TOutput>;
  // Add here any other functionality which is provided by whatever cloud provider being used (AWS, Azure, GCP, etc)
}

export type TokenVerifier<TOutput> = (
  scheme: string,
  token: string | undefined,
) => TE.TaskEither<Error, TOutput>;
