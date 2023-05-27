import * as t from "io-ts";
import type * as tyras from "@ty-ras/data-io-ts";

export const helloTarget = t.string;
export const helloResponse = t.string;
export type HelloTarget = tyras.ProtocolTypeOf<typeof helloTarget>;
export type HelloResponse = tyras.ProtocolTypeOf<typeof helloResponse>;
