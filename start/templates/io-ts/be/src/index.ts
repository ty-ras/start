import { taskEither as TE } from "fp-ts";
import type { resources } from "@ty-ras-extras/backend-io-ts";
import * as execution from "./execution";
import configValidation from "./config";
import * as api from "./api";
import type * as env from "./environment";

await execution.invokeMain({
  configValidation,
  // Change this name to something more suitable for your application
  envVarName: "MY_BACKEND_CONFIG",
  getServerParameters: ({ http }) => {
    const environment: env.Environment<never> = {
      tokenVerifier: () =>
        TE.left(
          new Error(
            "When creating authentication for the HTTP server, please replace this code call to actual token verification code in src/environment/<cloud provider name>/xyz.ts files.",
          ),
        ),
    };
    // Add DB pools and other pools needed by endpoints here.
    // Key should be state property name, and value class that will be validated using validator of that state property.
    // The class typically encapsulates value of "ResourcePool" value, created using "resources" export of "@ty-ras-extras/backend-io-ts" library.
    const poolsWithAdmins: Record<
      string,
      resources.ResourcePoolWithAdministration<never, void>
    > = {};
    return Promise.resolve({
      config: http,
      parameters: {
        endpoints: api.apiEndpoints,
        // Update as needed
        authScheme: "Bearer",
        pools: {
          // When new pools are added, something like this:
          // [api.DB_POOL_PROPERTY_NAME]: new api.DatabaseClass(poolsWithAdmins[api.DB_POOL_PROPERTY_NAME].pool)
        },
        tokenVerifierProperties: api.authenticationStateValidators,
        getAdditionalStateValue: () => {
          throw new Error(
            "When there are other properties than resource pools or authentication properties, this callback will be responsible to provide those for endpoints.",
          );
        },
      },
      admin: {
        // Needed so that
        allPoolAdmins: Object.values(poolsWithAdmins).map(
          ({ administration }) => administration,
        ),
        environment,
      },
    });
  },
});
