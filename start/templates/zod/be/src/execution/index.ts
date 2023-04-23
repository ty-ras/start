import type * as t from "zod";
import { main, configuration } from "@ty-ras-extras/backend-zod";
import * as poolEvictions from "./pool-evictions";
import * as http from "./http";
import * as config from "../config";
import type * as env from "../environment";

export const invokeMain = <
  TValidation extends t.ZodType,
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

const mainFunction = async <
  TValidation extends t.ZodType,
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
  // Transform stringified configuration into unvalidated configuration object
  // It will be either directly the value of environment variable, or read from file
  // Validate that configuration object adhers to configuration type specification
  const cfg = configuration.validateFromStringifiedJSON(
    configValidation,
    await configuration.getJSONStringValueFromMaybeStringWhichIsJSONOrFilenameFromEnvVar(
      envVarName,
      process.env[envVarName],
    ),
  );

  // Get the parameters for running server from validated configuration
  const {
    config,
    parameters,
    admin: {
      environment: { tokenVerifier },
      allPoolAdmins,
    },
  } = await getServerParameters(cfg);
  // Start http server
  await http.startHTTPServer(config, {
    ...parameters,
    tokenVerifier,
  });
  // eslint-disable-next-line no-console
  console.info(`Started server at ${config.server.host}:${config.server.port}`);
  // Now start evicting DB pools (this will never return, unless there are no pools)
  await poolEvictions.runPoolEvictions(allPoolAdmins);
};

export interface MainParameters<
  TValidation extends t.ZodType,
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
