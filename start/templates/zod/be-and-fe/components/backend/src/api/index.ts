import * as tyras from "@ty-ras/backend-node-zod-openapi";
import * as aux from "./auxiliary";
import * as endpoints from "./endpoints";

export {
  State,
  StateInfo,
  AuthenticatedState,
  AUTH_SCHEME,
  authenticationStateValidators,
  additionalStateValidators,
} from "./auxiliary";

const createEndpoints = () => {
  // Create builder: 'initial' which doesn't require any metadata added to endpoints
  // And 'withMD' which requires few OpenAPI manual things added to endpoints (schema generation is automatic).
  const { noMetadata, withOpenAPI } = aux.createBuilders<aux.StateInfo>();

  // Add endpoints with their metdata
  const helloEndpointsAndMD = endpoints.createHelloEndpoints(withOpenAPI);

  // Add endpoint to serve automatically generated OpenAPI Document
  const openapiDoc = endpoints.createOpenAPIEndpoint(
    noMetadata,
    withOpenAPI.getMetadataFinalResult(
      {
        openapi: {
          title: "The REST API",
          version: "0.1",
        },
      },
      [...getMetadatas(helloEndpointsAndMD, helloAPIPrefix)],
    ).openapi,
  ).endpoint;

  // Return endpoints
  return [
    // Behind '/api' prefix, we have other apis behind further prefixes:
    tyras.atPrefix(
      topLevelAPIPrefix,
      // Simple hello endpoints behind further '/hello' prefix
      combineEndpointsBehindPrefix(helloEndpointsAndMD, helloAPIPrefix),
    ),
    // At '/openapi' endpoint we serve OpenAPI document
    openapiDoc,
  ];
};

const getMetadatas = <TServerContext, TState>(
  endpoints: ReadonlyArray<
    tyras.AppEndpointWithMetadata<
      TServerContext,
      TState,
      {
        openapi: tyras.OpenAPIEndpointMD;
      }
    >
  >,
  endpointsPrefix: string,
) =>
  endpoints.map(({ getMetadata }) =>
    getMetadata(`${topLevelAPIPrefix}${endpointsPrefix}`),
  );

const combineEndpointsBehindPrefix = <TServerContext, TState>(
  endpoints: ReadonlyArray<
    tyras.AppEndpointWithMetadata<
      TServerContext,
      TState,
      {
        openapi: tyras.OpenAPIEndpointMD;
      }
    >
  >,
  endpointsPrefix: string,
) =>
  tyras.atPrefix(endpointsPrefix, ...endpoints.map(({ endpoint }) => endpoint));

const topLevelAPIPrefix = "/api";
const helloAPIPrefix = "/hello";

export const apiEndpoints = createEndpoints();