import * as tyras from "@ty-ras/frontend-fetch-io-ts";

export type APICallFactory = tyras.APICallFactory<"auth">;

export type APIEndpointsCreationParameters = [APICallFactory];

export const apiPrefix = "/api";
export const helloAPIPrefix = "/hello";
