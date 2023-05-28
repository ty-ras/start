import * as tyras from "@ty-ras/frontend-fetch-io-ts";
import * as t from "io-ts";
import * as protocol from "./protocol";
import * as common from "./common";

export const createEndpoints = (
  ...[factory]: common.APIEndpointsCreationParameters
) => {
  const prefix = `${common.apiPrefix}${common.helloAPIPrefix}`;
  const sayHello = factory.makeAPICall<protocol.hello.SayHello>({
    method: tyras.METHOD_GET,
    url: tyras.transitiveDataValidation(
      tyras.fromEncoder(
        t.type({
          target: t.string,
        }),
      ),
      (obj): tyras.DataValidatorResult<string> => ({
        error: "none",
        data: `${prefix}/${obj.target}`,
      }),
    ),
    response: tyras.fromDecoder(t.string),
  });
  return {
    sayHello,
  };
};
