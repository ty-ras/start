import * as tyras from "@ty-ras/frontend-fetch-zod";
import * as t from "zod";
import * as protocol from "@ty-ras-sample/protocol";
import * as common from "./common";

export const createEndpoints = (
  ...[factory]: common.APIEndpointsCreationParameters
) => {
  const prefix = `${common.apiPrefix}${common.helloAPIPrefix}`;
  const sayHello = factory.makeAPICall<protocol.hello.SayHello>({
    method: tyras.METHOD_GET,
    url: tyras.transitiveDataValidation(
      tyras.plainValidatorEncoder(
        t.object({
          target: t.string(),
        }),
      ),
      (obj): tyras.DataValidatorResult<string> => ({
        error: "none",
        data: `${prefix}/${obj.target}`,
      }),
    ),
    response: tyras.plainValidator(t.string()),
  });
  return {
    sayHello,
  };
};
