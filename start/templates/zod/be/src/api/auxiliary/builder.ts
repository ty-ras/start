/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import * as tyras from "@ty-ras/backend-node-zod-openapi";
import type { state } from "@ty-ras-extras/backend-zod";
import * as thisState from "./state";
import type * as types from "./types";

export const createBuilders = <
  TStateInfo extends state.TStateInfoOfKeysBase,
>() => {
  const noMetadata = tyras.startBuildingAPI<tyras.ServerContext, TStateInfo>();

  return {
    // Builder which allows defining endpoints without metadata
    // Will be needed for endpoint returning OpenAPI Document.
    noMetadata,
    // Builder which requires metadata, with or without authentication
    withOpenAPI: noMetadata.withMetadataProvider(
      "openapi",
      tyras.createOpenAPIProvider(
        tyras.createJsonSchemaFunctionality({
          contentTypes: [tyras.CONTENT_TYPE],
          transformSchema: tyras.convertToOpenAPISchemaObject,
        }),
      ),
      (statePropertyNames) => {
        return {
          securitySchemes: statePropertyNames.some(
            (name) => name in thisState.authenticatedStateSpec,
          )
            ? [
                {
                  name: "authentication",
                  scheme: {
                    type: "http",
                    scheme: AUTH_SCHEME,
                  },
                },
              ]
            : [],
        };
      },
    ),
  };
};

export const AUTH_SCHEME = "bearer";

export type PlainBuilder<
  TStateInfo extends state.TStateInfoOfKeysBase = thisState.StateInfo,
> = tyras.AppEndpointBuilderProvider<
  tyras.ServerContext,
  TStateInfo,
  unknown,
  unknown,
  {},
  {},
  {}
>;
export type Builder<
  TStateInfo extends state.TStateInfoOfKeysBase = thisState.StateInfo,
> = tyras.AppEndpointBuilderProvider<
  tyras.ServerContext,
  TStateInfo,
  tyras.AnyDecoder,
  tyras.AnyEncoder,
  tyras.OutputValidatorSpec<any, any>,
  tyras.InputValidatorSpec<any>,
  types.TMetadataProviders
>;
