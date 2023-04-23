import * as t from "io-ts";
import * as tt from "io-ts-types";

export type Config = t.TypeOf<typeof config>;
export type ConfigAuthentication = Config["authentication"];
export type ConfigHTTPServer = Config["http"];

const remoteEndpoint = t.type({
  host: tt.NonEmptyString,
  port: t.Int,
});

const authConfig = t.type(
  {
    // Insert authentication-related properties here
    // E.g. AWS pool ID + client ID + region, AzureAD tenant ID + app ID, etc.
  },
  "AuthConfig",
);

const config = t.type(
  {
    authentication: authConfig,
    http: t.type(
      {
        server: t.type(
          {
            ...remoteEndpoint.props,
            // TODO: certs
          },
          "HTTPServerConfig",
        ),
        // Remove this if CORS is not needed
        cors: t.type(
          {
            frontendAddress: tt.NonEmptyString,
          },
          "HTTPCorsConfig",
        ),
      },
      "HTTPConfig",
    ),
    // Insert any additional config properties here
    // E.g. database, messaging, etc
  },
  "BEConfig",
);

export default config;
