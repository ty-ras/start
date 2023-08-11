import * as t from "runtypes";

export type Config = t.Static<typeof config>;
export type ConfigAuthentication = Config["authentication"];
export type ConfigHTTPServer = Config["http"];

const remoteEPFields = {
  host: t.String.withConstraint((str) => str.length > 0),
  port: t.Number.withConstraint((n) => Number.isInteger(n)),
} as const;

const authConfig = t.Record({
  // Insert authentication-related properties here
  // E.g. AWS pool ID + client ID + region, AzureAD tenant ID + app ID, etc.
});

const config = t.Record({
  authentication: authConfig,
  http: t.Record({
    server: t.Record({
      ...remoteEPFields,
      // TODO: certs
    }),
    // Remove this if CORS is not needed
    cors: t.Record({
      frontendAddress: t.String.withConstraint((str) => str.length > 0),
    }),
  }),
  // Insert any additional config properties here
  // E.g. database, messaging, etc
});

export default config;
