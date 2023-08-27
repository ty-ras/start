/**
 * @file This file contains the code to call the greeting endpoint.
 */

import * as tyras from "@ty-ras/frontend-__TYRAS_CLIENT__-runtypes";
import { greeting } from "@ty-ras-sample/protocol";
import factory from "../factory";

export default {
  getGreeting: factory.makeAPICall<greeting.GetGreeting>({
    method: tyras.METHOD_GET,
    url: tyras.url`/api/greet/${tyras.urlParam(
      "target",
      greeting.data.greetingTarget,
    )}`,
    response: tyras.fromDecoder(greeting.data.greeting),
  }),
};
