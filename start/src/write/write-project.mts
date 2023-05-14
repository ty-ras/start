import * as F from "@effect/data/Function";
import * as S from "@effect/schema/Schema";
import * as Match from "@effect/match";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type * as input from "./validate-input.mjs";
import type * as events from "./events.mjs";
import materializePackageJson from "./materialize-package-json.mjs";
import packageJson from "./package-json.mjs";
import copyFiles, { type CopyInstruction } from "./copy-files.mjs";

export default async ({ validatedInput, packageRoot, onEvent }: Input) => {
  // Copy all files first
  onEvent?.({ event: "startCopyTemplateFiles", data: {} });
  await copyFiles(getCopyInstructions({ packageRoot, validatedInput }));
  onEvent?.({ event: "endCopyTemplateFiles", data: {} });

  // Now, fix all version specs of all package.json files into actual versions.
  onEvent?.({ event: "startFixPackageJsonVersions", data: {} });

  // Start by finding all package.json files
  const { folderName } = validatedInput;
  const allFilePaths = await getAllFilePaths(folderName);
  const packageJsonPaths = allFilePaths.filter(
    (filePath) => path.basename(filePath) === "package.json",
  );
  const projectName = path.basename(folderName);

  // Callback which will create the "name" field of package.json file.
  const extractPackageName = F.pipe(
    Match.value(packageJsonPaths.length),
    Match.when(0, () => {
      throw new Error(
        "Internal error: template contained no package.json files.",
      );
    }),
    // If only one package.json in the template, then just use that as a name
    Match.when(1, (): ExtractPackageName => () => projectName),
    // When there are multiple package.json files in the template, it means that there is workspaces-based setup.
    // Top-level package.json will be "@abc/main", while others will be "@abc/<folder name>"
    // This will be handled by the code running after emitting event "endFixPackageJsonVersions"
    Match.orElse(() => undefined),
  );
  // Now perform actual version fixing
  await Promise.all(
    packageJsonPaths.map((packageJsonPath) =>
      // Change the "^x.y.z" version specifications to "x.b.c" fixed versions
      materializePackageJson(
        onEvent,
        packageJsonPath,
        extractPackageName?.(packageJsonPath),
      ),
    ),
  );
  onEvent?.({ event: "endFixPackageJsonVersions", data: { packageJsonPaths } });

  // If there is more than one package.json file, we must switch all "@ty-ras-sample" strings into actual project prefix
  if (packageJsonPaths.length > 1) {
    onEvent?.({ event: "startFixingPackageNames", data: {} });
    const modifiedPaths: Set<string> = new Set();
    await Promise.all(
      allFilePaths.map(
        async (filePath) =>
          await F.pipe(
            await fs.readFile(filePath, "utf8"),
            (fileContents) => {
              const newFileContents = fileContents.replaceAll(
                "@ty-ras-sample",
                `@${projectName}`,
              );
              if (fileContents !== newFileContents) {
                modifiedPaths.add(filePath);
                onEvent?.({
                  event: "fixedPackageName",
                  data: { path: filePath },
                });
              }
              return newFileContents;
            },
            (newFileContents) =>
              fs.writeFile(filePath, newFileContents, "utf8"),
          ),
      ),
    );
    onEvent?.({
      event: "endFixingPackageNames",
      data: { paths: modifiedPaths },
    });
  }

  // We are done!
};

export interface Input {
  validatedInput: input.ValidatedInput;
  packageRoot: string;
  onEvent?: events.OnEvent;
}

// We export this only for tests
export const getAllFilePaths = async (rootDir: string) => {
  const filePaths: Array<string> = [];
  for await (const filePath of readDirRecursive(rootDir)) {
    filePaths.push(filePath);
  }
  return filePaths;
};

// For some reason, fs-extra doesn't have recursive readdir, so we have our own
async function* readDirRecursive(
  dir: string,
): AsyncGenerator<string, void, unknown> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      yield* readDirRecursive(res);
    } else {
      yield res;
    }
  }
}

type ExtractPackageName = (packageJsonPath: string) => string;

const getCopyInstructions = ({
  packageRoot,
  validatedInput: { folderName, packageManager, components, dataValidation },
}: Omit<Input, "onEvent">) => {
  const first: CopyInstruction = {
    source: path.join(packageRoot, "templates", dataValidation, components),
    target: folderName,
  };
  const retVal = [first];
  if (packageManager === "pnpm" && components === "be-and-fe") {
    // When we are doing workspace-based setup with pnpm, we must delete 'workspaces' field from package.json,
    // and emit pnpm-workspace.yaml with corresponding content.
    // Apparently supporting 'workspaces' field of package.json is some kind of principal problem:
    // https://github.com/pnpm/pnpm/issues/2255
    // Notice that we can't read the file at packageJsonPath _at this point_, as first copy step is not yet executed.
    const packageJsonPath = path.join(folderName, "package.json");
    let seenWorkspaces:
      | S.To<typeof packageJsonWithWorkspaces>["workspaces"]
      | undefined;
    retVal.push(
      // Write package.json without 'workspaces' property
      {
        source: async () =>
          F.pipe(
            await fs.readFile(packageJsonPath, "utf8"),
            JSON.parse,
            parsePackageJson,
            ({ workspaces, ...packageJsonContents }) => (
              (seenWorkspaces = workspaces), packageJsonContents
            ),
            JSON.stringify,
          ),
        target: packageJsonPath,
      },
      // Write pnpm-workspace.yaml file with same workspace information
      // Since none of the current runtime dependencies have YAML lib dependency, just write inline
      {
        source: () =>
          `packages:\n${(seenWorkspaces ?? [])
            .map((ws) => `  - '${ws}'`)
            .join("\n")}`,
        target: path.join(folderName, "pnpm-workspace.yaml"),
      },
    );
  }

  return retVal;
};

const packageJsonWithWorkspaces = F.pipe(
  packageJson,
  S.extend(
    S.struct({ workspaces: S.nonEmptyArray(F.pipe(S.string, S.nonEmpty())) }),
  ),
);
const parsePackageJson = F.pipe(packageJsonWithWorkspaces, S.parse);
