import * as t from "io-ts";
import * as tt from "io-ts-types";
import { configuration } from "@ty-ras-extras/frontend-io-ts";
import { function as F } from "fp-ts";

const config = F.pipe(
  import.meta.env["VITE_TYRAS_FE_CONFIG"],
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
