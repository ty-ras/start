import type * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import type { state } from "@ty-ras-extras/backend-io-ts";
import type * as thisState from "./state";
import type { taskEither as TE } from "fp-ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
export type EndpointSpec<
  TProtocolSpec extends tyras.ProtocolSpecCore<string, unknown>,
  TFunctionality extends TFunctionalityBase,
  TStateSpec extends object,
  TFullStateInfo extends state.TStateValidationBase = thisState.FullStateValidationInfo,
> = tyras.EndpointSpec<
  TProtocolSpec,
  () => FunctionalityOutput<TFunctionality>,
  tyras.ServerContext,
  state.StateInfoOfKeys<keyof TFullStateInfo>,
  state.GetState<TFullStateInfo, TStateSpec>,
  TMetadataProviders
>;

export type TMetadataProviders = {
  openapi: tyras.OpenAPIMetadataProvider<
    tyras.HeaderDecoder,
    tyras.HeaderEncoder,
    tyras.OutputValidatorSpec<any, any>,
    tyras.InputValidatorSpec<any>
  >;
};

export type TFunctionalityBase<TParams = any, TReturn = any> = (
  input: TParams,
) => TE.TaskEither<Error, TReturn>;

export type InlineFunctionality<TReturn> = () => TE.TaskEither<Error, TReturn>;

export type FunctionalityParameters<TFunctionality extends TFunctionalityBase> =
  TFunctionality extends TFunctionalityBase<infer T, infer _> ? T : never;
export type FunctionalityOutput<TFunctionality extends TFunctionalityBase> =
  TFunctionality extends TFunctionalityBase<infer _, infer T> ? T : never;
