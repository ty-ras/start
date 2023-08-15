import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import config from "./config";
import endpoints from "./api";
import auth from "./auth";

/* eslint-disable no-console */

const {
  http: {
    cors,
    server: { host, port },
  },
} = config;
const corsHandler = tyras.createCORSHandler({
  allowOrigin: cors.frontendAddress,
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: true,
});
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

function logEventArgs(
  eventArgs: tyras.VirtualRequestProcessingEvents<
    unknown,
    unknown
  >[keyof tyras.VirtualRequestProcessingEvents<unknown, unknown>],
) {
  const isError = "validationError" in eventArgs;
  console[isError ? "error" : "info"](
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tyras.omit(eventArgs, "ctx", "groups" as any, "regExp", "validationError"),
  );
  if (isError) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.error(JSON.stringify(eventArgs.validationError));
  }
}
