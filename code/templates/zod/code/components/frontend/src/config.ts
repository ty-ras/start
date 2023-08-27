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
  // Change this name to something more suitable for your application, and then update the '.env' file.
  import.meta.env["VITE_MY_FRONTEND_CONFIG"],
);
