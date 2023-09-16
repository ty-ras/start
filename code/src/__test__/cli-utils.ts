import * as process from "node:process";
import * as childProcess from "node:child_process";
import * as util from "node:util";

export const execFile = util.promisify(childProcess.execFile);

export const pathToCLI = `${process.cwd()}/bundle/cli.mjs`;
