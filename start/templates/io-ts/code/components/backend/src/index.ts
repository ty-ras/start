import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import { configuration } from "@ty-ras-extras/backend-io-ts";
import { function as F, taskEither as TE, either as E, io as IO } from "fp-ts";
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
await F.pipe(
  process.env[ENV_VAR_NAME],
  configuration.getJSONStringValueFromMaybeStringWhichIsJSONOrFilenameFromEnvVar(
    // Change this name to something more suitable for your application
    ENV_VAR_NAME,
  ),
  TE.chainEitherKW(configuration.validateFromStringifiedJSON(configValidation)),
  TE.chainFirstW(
    ({
      http: {
        cors,
        server: { host, port },
      },
    }) => {
      const corsHandler = tyras.createCORSHandler(createCORSOptions(cors));
      return TE.tryCatch(
        async () =>
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
          ),
        E.toError,
      );
    },
  ),
  TE.chainFirstIOK(
    ({
      http: {
        server: { host, port },
      },
    }) => IO.of(console.info(`Started server at ${host}:${port}.`)),
  ),
)();
