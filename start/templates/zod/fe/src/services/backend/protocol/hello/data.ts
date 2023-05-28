import * as t from "zod";
import type * as tyras from "@ty-ras/data-zod";

export const helloTarget = t.string();
export const helloResponse = t.string();
export type HelloTarget = tyras.ProtocolTypeOf<typeof helloTarget>;
export type HelloResponse = tyras.ProtocolTypeOf<typeof helloResponse>;
