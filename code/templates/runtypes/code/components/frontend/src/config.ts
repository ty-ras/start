import * as t from "runtypes";
import { configuration } from "@ty-ras-extras/frontend-runtypes";

export default configuration.validateFromMaybeStringifiedJSONOrThrow(
  t.Record({
    authentication: t.Record({
      // Insert your auth-provider-specific props here...
    }),
    backend: t.String.withConstraint((str) => str.length > 0),
  }),
  // Change this name to something more suitable for your application, and then update the '.env' file.
  import.meta.env["VITE_MY_FRONTEND_CONFIG"],
);
