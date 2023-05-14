import test from "ava";
import * as cliUtils from "./cli-utils";

test("Verify that help string is expected", async (c) => {
  c.plan(1);
  // We must spawn our .mjs code with cwd being outside from package dir, in order to fully simulate situation where package.json is not in cwd.
  const outputs = await cliUtils.execFile(cliUtils.pathToCLI, ["--help"], {
    cwd: "/",
    shell: false,
  });
  c.deepEqual(outputs, {
    stdout: expectedHelpText,
    stderr: "",
  });
});

const expectedHelpText = `
  Usage: npx @ty-ras/start@latest [options...] [folder]

  All options and folder are optional as command-line arguments.
  If any of them is omitted, the program will prompt for their values.
  Options:
    --packageManager, -m	Which package manager will be used in the project?
          Schema: "yarn"|"npm"|"pnpm"|"unspecified"
    --components, -p	Which components will be using TyRAS libraries?
          Schema: "be"|"fe"|"be-and-fe"
    --dataValidation, -d	Which data validation framework should TyRAS be providing?
          Schema: "io-ts"|"zod"
    --server, -s	Which server should TyRAS be providing?
          Used only when components is "be" or "be-and-fe".
          Schema: "node"
    --client, -c	Which client should TyRAS be providing?
          Used only when components is "fe" or "be-and-fe".
          Schema: "fetch"
    --setupGit, -g	Should the project folder be initialized with Git?
          Only if Git is detected to be installed
          Schema: boolean
    --installDependencies, -i	Should the project dependencies be installed?
          Only if selected package manager is detected to be installed
          Schema: boolean

`;
