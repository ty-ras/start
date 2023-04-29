import * as t from "zod";
import { configuration } from "@ty-ras-extras/frontend-zod";

export default configuration.validateFromMaybeStringifiedJSONOrThrow(
  t
    .object({
      authentication: t
        .object({
          // Insert your auth-provider-specific props here...
        })
        .describe("AuthConfig"),
      backend: t.string().nonempty(),
    })
    .describe("FEConfig"),
  import.meta.env["VITE_MY_FRONTEND_CONFIG"],
);
