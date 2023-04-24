import * as t from "zod";

export type Config = t.TypeOf<typeof config>;
export type ConfigAuthentication = Config["authentication"];
export type ConfigHTTPServer = Config["http"];

const remoteEndpoint = t.object({
  host: t.string().nonempty(),
  port: t.number().int(),
});

const authConfig = t
  .object({
    // Insert authentication-related properties here
    // E.g. AWS pool ID + client ID + region, AzureAD tenant ID + app ID, etc.
  })
  .describe("AuthConfig");

const config = t
  .object({
    authentication: authConfig,
    http: t
      .object({
        server: t
          .object({
            ...remoteEndpoint.shape,
            // TODO: certs
          })
          .describe("HTTPServerConfig"),
        // Remove this if CORS is not needed
        cors: t
          .object({
            frontendAddress: t.string().nonempty(),
          })
          .describe("HTTPCorsConfig"),
      })
      .describe("HTTPConfig"),
    // Insert any additional config properties here
    // E.g. database, messaging, etc
  })
  .describe("BEConfig");

export default config;
