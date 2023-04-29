import * as t from "zod";
import * as tyras from "@ty-ras/backend-node-zod-openapi";
import * as protocol from "../protocol";
import * as aux from "../auxiliary";

export const createHelloEndpoints = (builder: aux.Builder) => {
  return [
    builder.atURL`/${helloTarget}`.batchSpec(hello).createEndpoint({
      openapi: {
        description: "Get a greeting for given target.",
      },
    }),
  ];
};

const helloResponse = protocol.hello.data.helloResponse;

const helloTarget = tyras.urlParameter(
  "target",
  protocol.hello.data.helloTarget,
);

const example: t.TypeOf<typeof helloResponse> = "Hello, world!";

const stateSpec = {
  // Notice: we don't include authenticated state spec, because this is not authenticated endpoint
} as const;

const urlParameters = {
  target: {
    description: "The target of the greeting.",
  },
};

const hello: aux.EndpointSpec<
  protocol.hello.SayHello,
  aux.InlineFunctionality<tyras.RuntimeOf<protocol.hello.data.HelloResponse>>,
  typeof stateSpec
> = {
  state: aux.endpointState(stateSpec),
  method: tyras.METHOD_GET,
  endpointHandler: ({ url: { target } }) => `Hello, ${target}!`,
  output: tyras.responseBody(helloResponse),
  mdArgs: {
    openapi: {
      ...aux.mdArgsBase(
        { description: "The greeting for the given target", example },
        { description: "Get the greeting of the given target" },
      ),
      urlParameters,
    },
  },
};
