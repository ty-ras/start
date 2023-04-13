import * as tyras from "@ty-ras/frontend-fetch-io-ts";
import config from "../../config";
import * as hello from "./hello";

export const callRawHTTP = tyras.createCallHTTPEndpoint(config.backend);

const createBackend = () => {
  const factory = createFactory(callRawHTTP);
  return {
    hello: hello.createEndpoints(factory),
  };
};

const createFactory = (callHttp: tyras.CallHTTPEndpoint) =>
  tyras.createAPICallFactory(callHttp).withHeaders({});

const backend = createBackend();
export default backend;
