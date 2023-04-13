/* eslint-disable no-console */
import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import { function as F, either as E } from "fp-ts";
export const startHTTPServer = async ({ server, cors }, { endpoints, tokenVerifier, tokenVerifierProperties, pools, authScheme, getAdditionalStateValue, }) => {
    const corsHandler = tyras.createCORSHandler(createCORSOptions(cors));
    await tyras.listenAsync(tyras.createServer({
        // Endpoints comprise the REST API as a whole
        endpoints,
        // React on various server events.
        events: F.flow(
        // First, trigger CORS handler (it will modify the context object of eventArgs)
        (eventName, eventArgs) => ({
            eventName,
            eventArgs,
            corsTriggered: corsHandler(eventName, eventArgs),
        }), 
        // Then log event info + whether CORS triggered to console
        ({ eventName, eventArgs, corsTriggered }) => (console.info("EVENT", eventName, corsTriggered),
            // eslint-disable-next-line sonarjs/no-use-of-empty-return-value
            logEventArgs(eventArgs))),
        // Create the state object for endpoints
        // Endpoints specify which properties of State they want, and this callback tries to provide them
        // The final validation of the returned state object is always done by endpoint specification, and thus it is enough to just attempt to e.g. provide username.
        // Some endpoints will then fail on username missing, and some others can recover from that.
        createState: async ({ stateInfo: statePropertyNames, context,
        // eslint-disable-next-line sonarjs/cognitive-complexity
         }) => {
            const state = {};
            const getVerifierOutputLazy = lazyAsync(async () => await tokenVerifier(`${authScheme} `, context.headers["authorization"])());
            for (const propertyName of statePropertyNames) {
                if (isPropertyInObject(pools, propertyName)) {
                    state[propertyName] = pools[propertyName];
                }
                else if (isPropertyInObject(tokenVerifierProperties, propertyName)) {
                    if (!getVerifierOutputLazy.hasBeenInvoked()) {
                        const verifierOutput = await getVerifierOutputLazy.promise();
                        if (E.isLeft(verifierOutput)) {
                            console.error("Token validation error: ", verifierOutput);
                        }
                        else {
                            Object.entries(verifierOutput.right).forEach(([key, value]) => (state[key] = value));
                        }
                    }
                }
                else {
                    state[propertyName] =
                        getAdditionalStateValue(propertyName);
                }
            }
            return state;
        },
    }), server.host, server.port);
};
const lazyAsync = (retrieveValue) => {
    let valuePromise;
    return {
        hasBeenInvoked: () => valuePromise !== undefined,
        promise: async () => {
            if (valuePromise === undefined) {
                valuePromise = retrieveValue();
            }
            return await valuePromise;
        },
    };
};
const logEventArgs = (eventArgs) => {
    const isError = "validationError" in eventArgs;
    console[isError ? "error" : "info"](
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tyras.omit(eventArgs, "ctx", "groups", "regExp", "validationError"));
    if (isError) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.error(JSON.stringify(eventArgs.validationError));
    }
};
const createCORSOptions = ({ frontendAddress, }) => ({
    allowOrigin: frontendAddress,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: true,
});
const isPropertyInObject = (object, propertyName) => propertyName in object;
