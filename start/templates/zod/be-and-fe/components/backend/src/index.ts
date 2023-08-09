import * as tyras from "@ty-ras/backend-node-zod-openapi";
import { configuration } from "@ty-ras-extras/backend-zod";
import * as process from "node:process";
import configValidation, { type ConfigHTTPServer } from "./config";
import endpoints from "./api";
import auth from "./auth";

/* eslint-disable no-console */

const createCORSOptions = ({
  frontendAddress,
}: ConfigHTTPServer["cors"]): tyras.CORSOptions => ({
  allowOrigin: frontendAddress,
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: true,
});

const logEventArgs = (
  eventArgs: tyras.VirtualRequestProcessingEvents<
    unknown,
    unknown
  >[keyof tyras.VirtualRequestProcessingEvents<unknown, unknown>],
) => {
  const isError = "validationError" in eventArgs;
  console[isError ? "error" : "info"](
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tyras.omit(eventArgs, "ctx", "groups" as any, "regExp", "validationError"),
  );
  if (isError) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.error(JSON.stringify(eventArgs.validationError));
  }
};

const ENV_VAR_NAME = "MY_BACKEND_CONFIG";
const {
  http: {
    cors,
    server: { host, port },
  },
} = configuration.validateFromMaybeStringifiedJSONOrThrow(
  configValidation,
  await configuration.getJSONStringValueFromMaybeStringWhichIsJSONOrFilenameFromEnvVar(
    ENV_VAR_NAME,
    process.env[ENV_VAR_NAME],
  ),
);

const corsHandler = tyras.createCORSHandler(createCORSOptions(cors));

await tyras.listenAsync(
  tyras.createServer({
    endpoints,
    createState: async ({ stateInfo: statePropertyNames }) => {
      const state: Partial<
        Record<(typeof statePropertyNames)[number], unknown>
      > = {};
      for (const propertyName of statePropertyNames) {
        if (propertyName in tyras.DEFAULT_AUTHENTICATED_STATE) {
          state[propertyName] = await auth();
        }
      }

      return state;
    },
    // React on various server events.
    events: (eventName, eventArgs) => {
      // First, trigger CORS handler (it will modify the context object of eventArgs)
      const corsTriggered = corsHandler(eventName, eventArgs);

      // Then log event info + whether CORS triggered to console
      console.info("EVENT", eventName, corsTriggered);
      logEventArgs(eventArgs);
    },
  }),
  host,
  port,
);

console.info(`Started server at ${host}:${port}.`);
