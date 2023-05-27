import * as tyras from "@ty-ras/frontend-fetch-io-ts";
import config from "../../config";
import * as hello from "./hello";

const factory = tyras.createAPICallFactory(config.backend).withHeaders({});
export default {
  hello: hello.createEndpoints(factory),
};
