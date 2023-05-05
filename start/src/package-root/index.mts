import * as F from "@effect/data/Function";
import * as path from "node:path";
import * as url from "node:url";

export default F.pipe(
  path.join(
    // From: https://blog.logrocket.com/alternatives-dirname-node-js-es-modules/
    url.fileURLToPath(new URL(".", import.meta.url)),
    "..",
    "..",
  ),
  path.normalize,
);
