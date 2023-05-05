import * as F from "@effect/data/Function";
import * as Match from "@effect/match";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as fse from "fs-extra";
import type * as input from "./validate-input.mjs";
import type * as events from "./events.mjs";
import materializePackageJson from "./materialize-package-json.mjs";
import packageRoot from "../package-root/index.mjs";

export default async ({
  validatedInput: { folderName, dataValidation, components },
  onEvent,
}: Input) => {
  // Copy all files first
  onEvent?.({ event: "startCopyTemplateFiles", data: {} });
  await fse.copy(
    path.join(packageRoot, "templates", dataValidation, components),
    folderName,
  );
  onEvent?.({ event: "endCopyTemplateFiles", data: {} });

  // Now, fix all version specs of all package.json files into actual versions.
  onEvent?.({ event: "startFixPackageJsonVersions", data: {} });

  // Start by finding all package.json files
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
    Match.orElse(
      // TODO - package.json name in these cases is actually not used.
      (): ExtractPackageName => (packageJsonPath) =>
        `@${projectName}/${
          path.dirname(packageJsonPath) === folderName
            ? // Top-level package.json is just a container for "workspaces"
              "main"
            : // Uppermost directory name (e.g. "components/backend/package.json" -> "backend")
              path.basename(path.dirname(packageJsonPath))
        }`,
    ),
  );
  // Now perform actual version fixing
  await Promise.all(
    packageJsonPaths.map((packageJsonPath) =>
      // Change the "^x.y.z" version specifications to "x.b.c" fixed versions
      materializePackageJson(
        onEvent,
        packageJsonPath,
        extractPackageName(packageJsonPath),
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
