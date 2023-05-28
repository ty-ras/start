import * as tyras from "@ty-ras/backend-node-zod-openapi";
import type { state } from "@ty-ras-extras/backend-zod";
import type * as thisState from "./state";

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
  TMetadataProviders,
  typeof CONTENT_TYPE,
  typeof CONTENT_TYPE
>;

export type TMetadataProviders = {
  openapi: tyras.OpenAPIMetadataProvider<
    tyras.HeaderDecoder,
    tyras.HeaderEncoder,
    tyras.OutputValidatorSpec<any, any, typeof CONTENT_TYPE>,
    tyras.InputValidatorSpec<any, typeof CONTENT_TYPE>
  >;
};

export type TFunctionalityBase<TParams = any, TReturn = any> = (
  input: TParams,
) => Promise<TReturn>;

export type InlineFunctionality<TReturn> = () => Promise<TReturn>;

export type FunctionalityParameters<TFunctionality extends TFunctionalityBase> =
  TFunctionality extends TFunctionalityBase<infer T, infer _> ? T : never;
export type FunctionalityOutput<TFunctionality extends TFunctionalityBase> =
  TFunctionality extends TFunctionalityBase<infer _, infer T> ? T : never;

export const CONTENT_TYPE = tyras.CONTENT_TYPE;
