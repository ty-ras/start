import type * as data from "./data";

export interface SayHello {
  method: "GET";
  url: {
    target: data.HelloTarget;
  };
  responseBody: data.HelloResponse;
}
