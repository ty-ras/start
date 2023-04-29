import * as t from "zod";

export const helloTarget = t.string();
export const helloResponse = t.string();
export type HelloTarget = t.TypeOf<typeof helloTarget>;
export type HelloResponse = t.TypeOf<typeof helloResponse>;
