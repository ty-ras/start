import { function as F, either as E, taskEither as TE } from "fp-ts";
import type * as t from "io-ts";
import { main, configuration } from "@ty-ras-extras/backend-zod";
import * as poolEvictions from "./pool-evictions";
import * as http from "./http";
import * as config from "../config";
import type * as env from "../environment";

export const invokeMain = <
  TValidation extends t.Mixed,
  TokenVerifierOutput extends Record<string, unknown>,
  TPools extends Record<string, unknown>,
  TStateProperties extends http.TStatePropertiesBase<
    TokenVerifierOutput,
    TPools
  >,
>(
  mainParams: MainParameters<
    TValidation,
    TokenVerifierOutput,
    TPools,
    TStateProperties
  >,
) => main.invokeMain(() => mainFunction(mainParams), true);

const mainFunction = <
  TValidation extends t.Mixed,
  TokenVerifierOutput extends Record<string, unknown>,
  TPools extends Record<string, unknown>,
  TStateProperties extends http.TStatePropertiesBase<
    TokenVerifierOutput,
    TPools
  >,
>({
  configValidation,
  envVarName,
  getServerParameters,
}: MainParameters<
  TValidation,
  TokenVerifierOutput,
  TPools,
  TStateProperties
>) => {
  return F.pipe(
    // Extract stringified configuration from environment variable
    process.env[envVarName],
    // Transform stringified configuration into unvalidated configuration object
    // It will be either directly the value of environment variable, or read from file
    configuration.getJSONStringValueFromMaybeStringWhichIsJSONOrFilenameFromEnvVar(
      envVarName,
    ),
    // Validate that configuration object adhers to configuration type specification
    TE.chainEitherKW(
      configuration.validateFromStringifiedJSON(configValidation),
    ),
    // Get the parameters for running server from validated configuration
    TE.chainW((cfg) =>
      TE.tryCatch(async () => await getServerParameters(cfg), E.toError),
    ),
    // Start http server, and ignore return value (but still catch errors)
    TE.chainFirstW(
      ({
        config,
        parameters,
        admin: {
          environment: { tokenVerifier },
        },
      }) =>
        TE.tryCatch(
          async () => (
            await http.startHTTPServer(config, {
              ...parameters,
              tokenVerifier,
            }),
            // eslint-disable-next-line no-console
            console.info(
              `Started server at ${config.server.host}:${config.server.port}`,
            )
          ),
          E.toError,
        ),
    ),
    // Now start evicting DB pools (this will never return, unless there are no pools)
    TE.chainW(({ admin: { allPoolAdmins } }) =>
      TE.tryCatch(
        async () => await poolEvictions.runPoolEvictions(allPoolAdmins),
        E.toError,
      ),
    ),
  );
};

export interface MainParameters<
  TValidation extends t.Mixed,
  TokenVerifierOutput extends Record<string, unknown>,
  TPools extends Record<string, unknown>,
  TStateProperties extends http.TStatePropertiesBase<
    TokenVerifierOutput,
    TPools
  >,
> {
  configValidation: TValidation;
  envVarName: string;
  getServerParameters: (
    cfg: t.TypeOf<TValidation>,
  ) => Promise<
    ExecutionServerParameters<TokenVerifierOutput, TPools, TStateProperties>
  >;
}

export interface ServerAdministration<TTokenVerifierOutput> {
  allPoolAdmins: poolEvictions.ResourcePoolAdministrations;
  environment: env.Environment<TTokenVerifierOutput>;
}

export interface ExecutionServerParameters<
  TokenVerifierOutput extends Record<string, unknown>,
  TPools extends Record<string, unknown>,
  TStateProperties extends http.TStatePropertiesBase<
    TokenVerifierOutput,
    TPools
  >,
> {
  config: config.ConfigHTTPServer;
  parameters: ExecutionHTTPServerParameters<
    TokenVerifierOutput,
    TPools,
    TStateProperties
  >;
  admin: ServerAdministration<TokenVerifierOutput>;
}

export type ExecutionHTTPServerParameters<
  TokenVerifierOutput extends Record<string, unknown>,
  TPools extends Record<string, unknown>,
  TStateProperties extends http.TStatePropertiesBase<
    TokenVerifierOutput,
    TPools
  >,
> = Omit<
  http.ServerParameters<TokenVerifierOutput, TPools, TStateProperties>,
  "tokenVerifier"
>;
