import { function as F, either as E, taskEither as TE } from "fp-ts";
import { main, configuration } from "@ty-ras-extras/backend-io-ts";
import * as poolEvictions from "./pool-evictions";
import * as http from "./http";
export const invokeMain = (mainParams) => main.invokeMain(() => mainFunction(mainParams), true);
const mainFunction = ({ configValidation, envVarName, getServerParameters, }) => {
    return F.pipe(
    // Extract stringified configuration from environment variable
    process.env[envVarName], 
    // Transform stringified configuration into unvalidated configuration object
    // It will be either directly the value of environment variable, or read from file
    configuration.getJSONStringValueFromMaybeStringWhichIsJSONOrFilenameFromEnvVar(envVarName), 
    // Validate that configuration object adhers to configuration type specification
    TE.chainEitherKW(configuration.validateFromStringifiedJSON(configValidation)), 
    // Get the parameters for running server from validated configuration
    TE.chainW((cfg) => TE.tryCatch(async () => await getServerParameters(cfg), E.toError)), 
    // Start http server, and ignore return value (but still catch errors)
    TE.chainFirstW(({ config, parameters, admin: { environment: { tokenVerifier }, }, }) => TE.tryCatch(async () => (await http.startHTTPServer(config, {
        ...parameters,
        tokenVerifier,
    }),
        // eslint-disable-next-line no-console
        console.info("Started server")), E.toError)), 
    // Now start evicting DB pools (this will never return, unless there are no pools)
    TE.chainW(({ admin: { allPoolAdmins } }) => TE.tryCatch(async () => await poolEvictions.runPoolEvictions(allPoolAdmins), E.toError)));
};
