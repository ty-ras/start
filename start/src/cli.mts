#!/usr/bin/env node

import main from "./index.mjs";

// TODO use @ty-ras-extras/main to invoke this? It would ensure that process.exit would be called once this is done,
// thus avoiding possible spinner or something else keeping process alive.
await main();
