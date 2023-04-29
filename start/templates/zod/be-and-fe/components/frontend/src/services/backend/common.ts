import * as tyras from "@ty-ras/frontend-fetch-zod";

export type APICallFactory = tyras.APICallFactory<tyras.HKTEncoded, "auth">;

export type APIEndpointsCreationParameters = [APICallFactory];

export const apiPrefix = "/api";
export const helloAPIPrefix = "/hello";
