/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import * as thisState from "./state";
export const createBuilders = () => {
    const noMetadata = tyras.startBuildingAPI();
    return {
        // Builder which allows defining endpoints without metadata
        // Will be needed for endpoint returning OpenAPI Document.
        noMetadata,
        // Builder which requires metadata, with or without authentication
        withOpenAPI: noMetadata.withMetadataProvider("openapi", tyras.createOpenAPIProvider(tyras.createJsonSchemaFunctionality({
            contentTypes: [tyras.CONTENT_TYPE],
            transformSchema: tyras.convertToOpenAPISchemaObject,
        })), (statePropertyNames) => {
            return {
                securitySchemes: statePropertyNames.some((name) => name in thisState.authenticatedStateSpec)
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
        }),
    };
};
export const AUTH_SCHEME = "bearer";
