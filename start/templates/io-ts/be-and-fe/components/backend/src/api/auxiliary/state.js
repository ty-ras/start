import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import { state } from "@ty-ras-extras/backend-io-ts";
import * as services from "../../services";
export const authenticationStateValidators = {
    // Here one can have e.g. user ID, user name, or something else
    // Property names are freely decidable, but values must be IO-TS validators (directly from io-ts, io-ts-types, or tyras.instanceOf(...)).
    userId: services.uuidValidation("UserID"),
};
export const authenticatedStateSpec = tyras.transformEntries(authenticationStateValidators, () => { });
export const additionalStateValidators = {
// Here one can have e.g. DB connection pool, in-memory caches, etc
// Property names are freely decidable as long as they don't clash with what is in authenticationStateValidators.
// Values must be IO-TS validators (directly from io-ts, io-ts-types, or tyras.instanceOf(...)).
};
export const endpointState = state.createStateValidatorFactory(state.getFullStateValidationInfo(
// Authentication-related
authenticationStateValidators, 
// Generic
additionalStateValidators));
