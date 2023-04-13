import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import * as protocol from "@ty-ras-sample/protocol";
import * as aux from "../auxiliary";
export const createHelloEndpoints = (builder) => {
    return [
        builder.atURL `/${helloTarget}`.batchSpec(hello).createEndpoint({
            openapi: {
                description: "Get a greeting for given target.",
            },
        }),
    ];
};
const helloResponse = protocol.hello.data.helloResponse;
const helloTarget = tyras.urlParameter("target", protocol.hello.data.helloTarget);
const example = "Hello, world!";
const stateSpec = {
// Notice: we don't include authenticated state spec, because this is not authenticated endpoint
};
const urlParameters = {
    target: {
        description: "The target of the greeting.",
    },
};
const hello = {
    state: aux.endpointState(stateSpec),
    method: tyras.METHOD_GET,
    endpointHandler: ({ url: { target } }) => `Hello, ${target}!`,
    output: tyras.responseBody(helloResponse, false),
    mdArgs: {
        openapi: {
            ...aux.mdArgsBase({ description: "The greeting for the given target", example }, { description: "Get the greeting of the given target" }),
            urlParameters,
        },
    },
};
