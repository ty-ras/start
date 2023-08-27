import { configuration } from "@ty-ras-extras/backend-runtypes";
import * as t from "runtypes";
import * as process from "node:process";

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

// Change this name to something more suitable for your application, and then update the 'dev' script in package.json file.
const ENV_VAR_NAME = "MY_BACKEND_CONFIG";
export default configuration.validateFromMaybeStringifiedJSONOrThrow(
  config,
  await configuration.getJSONStringValueFromMaybeStringWhichIsJSONOrFilenameFromEnvVar(
    ENV_VAR_NAME,
    process.env[ENV_VAR_NAME],
  ),
);
