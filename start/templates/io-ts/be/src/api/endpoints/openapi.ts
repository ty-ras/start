import * as aux from "../auxiliary";
import { OpenAPIV3 as openapi } from "openapi-types";
import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import * as t from "io-ts";
import * as tls from "tls";

export const createOpenAPIEndpoint = (
  builder: aux.PlainBuilder,
  metadata: openapi.Document,
) => {
  // Notice that this will be undefined if all operations are behind authentication
  const metadataNotAuth = tyras.removeAuthenticatedOperations(metadata);
  return (
    // At /openapi URL
    builder.atURL`/openapi`
      // For method GET, and with *optional* "userId" state property
      .forMethod(tyras.METHOD_GET, aux.endpointState({ userId: false }))
      // Do the following
      .withoutBody(
        // Return OpenAPI document which doesn't have any information about authenticated endpoints for request which don't have username information
        ({ state: { userId }, context }) => {
          let returnMD = userId ? metadata : metadataNotAuth;
          if (returnMD) {
            const host = context.req.headers["host"];
            if (host) {
              const scheme =
                context.req.socket instanceof tls.TLSSocket ? "https" : "http";
              returnMD = {
                ...returnMD,
                servers: [{ url: `${scheme}://${host}` }],
              };
            }
          }
          return returnMD;
        },
        // We could pass proper validator for this, but let's go with unknown for now.
        tyras.responseBodyForValidatedData(t.unknown),
        // No metadata spec - as this is the metadata-returning endpoint itself
        {},
      )
      .createEndpoint({})
  );
};
