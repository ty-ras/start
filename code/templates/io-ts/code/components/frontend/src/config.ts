import * as t from "io-ts";
import * as tt from "io-ts-types";
import { configuration } from "@ty-ras-extras/frontend-io-ts";
import { function as F } from "fp-ts";

const config = F.pipe(
  // Change this name to something more suitable for your application, and then update the '.env' file.
  import.meta.env["VITE_MY_FRONTEND_CONFIG"],
  configuration.validateFromMaybeStringifiedJSONOrThrow(
    t.readonly(
      t.type(
        {
          authentication: t.type(
            {
              // Insert your auth-provider-specific props here...
            },
            "AuthConfig",
          ),
          backend: tt.NonEmptyString,
        },
        "FEConfig",
      ),
    ),
  ),
);

export default config;
