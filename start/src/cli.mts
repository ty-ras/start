import main from "./index.mjs";

// TODO use @ty-ras main to invoke this? It would ensure that process.exit would get call once this is done,
// thus avoiding possible spinner or something else keeping process alive.
await main();
