import * as F from "@effect/data/Function";
import * as S from "@effect/schema/Schema";
import * as Match from "@effect/match";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as inputSpec from "./input-spec.mjs";
import type * as validatedInput from "./validate-input.mjs";
import type * as events from "./events.mjs";
import materializePackageJson, {
  parsePackageJson as parsePackageJsonWithoutWorkspaces,
  type FixPackageJsonDependencies,
} from "./materialize-package-json.mjs";
import packageJson from "./package-json.mjs";
import copyFiles, { type CopyInstruction } from "./copy-files.mjs";
import processFileContents, {
  type FileContentsReplacement,
} from "./process-file-contents.mjs";

export default async ({ validatedInput, packageRoot, onEvent }: Input) => {
  // Copy all files first
  onEvent?.({ event: "startCopyTemplateFiles", data: {} });
  await copyFiles(getCopyInstructions({ packageRoot, validatedInput }));
  onEvent?.({ event: "endCopyTemplateFiles", data: {} });

  // We have now copied the correct raw template files to correct paths.
  // But BEFORE starting to fix package dependency versions, we must replace all the placeholders with actual values.
  onEvent?.({ event: "startProcessingFileContents", data: {} });
  const { folderName, packageManager } = validatedInput;
  const allFilePaths = await getAllFilePaths(folderName);
  const packageJsonPaths = allFilePaths.filter(
    (filePath) => path.basename(filePath) === PACKAGE_JSON,
  );
  const projectName = path.basename(folderName);
  const fileProcessInstructions: Array<FileContentsReplacement> = [
    {
      searchFor: "__PACKAGE_MANAGER__",
      // NPM Reasonable choice if package manager was not specified, since instructions tell this to be invoked via `npx`
      replaceWith:
        packageManager === inputSpec.PACKAGE_MANAGER_UNSPECIFIED
          ? inputSpec.PACKAGE_MANAGER_NPM
          : packageManager,
    },
    {
      searchFor: "@ty-ras-sample",
      replaceWith: packageJsonPaths.length > 1 ? `@${projectName}` : "..",
    },
    {
      searchFor: "__TYRAS_SERVER__",
      replaceWith:
        "server" in validatedInput
          ? validatedInput.server
          : "internal_bug_server_ref_in_non_server_project",
    },
    {
      searchFor: "__TYRAS_CLIENT__",
      replaceWith:
        "client" in validatedInput
          ? validatedInput.client
          : "internal_bug_client_ref_in_non_client_project",
    },
  ];
  const modifiedPaths = await processFileContents(
    allFilePaths.map((filePath) => ({
      filePath,
      replacementData: fileProcessInstructions,
    })),
  );
  onEvent?.({
    event: "endProcessingFileContents",
    data: { paths: modifiedPaths },
  });

  // Now, fix all version specs of all package.json files into actual versions.
  onEvent?.({ event: "startFixPackageJsonVersions", data: {} });

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
  const fixDeps =
    packageManager === "pnpm"
      ? createFixPnpmDependencies(validatedInput.dataValidation)
      : undefined;
  const fixDevDeps =
    "server" in validatedInput
      ? createFixDevDependencies(
          validatedInput.components,
          getServerInfo(validatedInput.server),
        )
      : undefined;
  await Promise.all(
    packageJsonPaths.map((packageJsonPath) =>
      // Change the "^x.y.z" version specifications to "x.b.c" fixed versions
      materializePackageJson(
        onEvent,
        packageJsonPath,
        extractPackageName?.(packageJsonPath),
        fixDeps,
        fixDevDeps,
      ),
    ),
  );
  onEvent?.({ event: "endFixPackageJsonVersions", data: { packageJsonPaths } });

  // We are done!
};

export interface Input {
  validatedInput: validatedInput.ValidatedInput;
  packageRoot: string;
  onEvent?: events.OnEvent;
}

// We export this only for tests
export const getAllFilePaths = async (
  rootDir: string,
  includeDir?: (dirName: string) => boolean,
) => {
  const filePaths: Array<string> = [];
  for await (const filePath of readDirRecursive(
    rootDir,
    includeDir ?? (() => true),
  )) {
    filePaths.push(filePath);
  }
  return filePaths;
};

// For some reason, fs-extra doesn't have recursive readdir, so we have our own
async function* readDirRecursive(
  dir: string,
  includeDir: (dirName: string) => boolean,
): AsyncGenerator<string, void, unknown> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (includeDir(res)) {
        yield* readDirRecursive(res, includeDir);
      }
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
  const sourcePathComponentsBase = [
    packageRoot,
    "templates",
    dataValidation,
    "code",
  ];
  const sourcePathComponents = [...sourcePathComponentsBase];
  if (components !== "be-and-fe") {
    sourcePathComponents.push("components", getComponentFolderName(components));
  }
  const retVal: Array<CopyInstruction> = [
    {
      source: path.join(...sourcePathComponents),
      target: folderName,
    },
    // Apparently NPM publish pretty much refuses to include .gitignore files:
    // https://github.com/npm/npm/issues/3763
    // https://stackoverflow.com/questions/24942161/does-npm-ignore-files-listed-in-gitignore
    // So use separate step to copy and rename it, since creating empty .npmignore did not help.
    // And also am not willing to add it to package.json files list explicitly
    {
      source: path.join(...sourcePathComponentsBase.slice(0, -1), "gitignore"),
      target: path.join(folderName, ".gitignore"),
    },
  ];
  if (components !== "be-and-fe") {
    // We must perform the following post-processing operations:
    const protocolSourceFolder = sourcePathComponents
      .slice(0, -1)
      .concat("protocol", "src");
    const protocolTargetFolder = [folderName, "src"].concat(
      ...(components === "be"
        ? ["api", "protocol"]
        : ["services", "backend", "protocol"]),
    );
    retVal.push(
      // 1. Copy protocol code directly to src/api folder
      {
        source: path.join(...protocolSourceFolder.concat("index.ts")),
        target: path.join(...protocolTargetFolder.concat("index.ts")),
      },
      {
        source: path.join(...protocolSourceFolder.concat("greeting")),
        target: path.join(...protocolTargetFolder.concat("greeting")),
      },
      // 2. Copy <template root>/tsconfig.base.json, .prettierrc, .eslintrc.base.cjs
      {
        source: path.join(
          ...sourcePathComponentsBase.concat("tsconfig.base.json"),
        ),
        target: path.join(folderName, "tsconfig.base.json"),
      },
      {
        source: path.join(...sourcePathComponentsBase.concat(".prettierrc")),
        target: path.join(folderName, ".prettierrc"),
      },
      {
        source: path.join(
          ...sourcePathComponentsBase.concat(".eslintrc.base.cjs"),
        ),
        target: path.join(folderName, ".eslintrc.base.cjs"),
      },
      // 3. fix paths in tsconfig.json, .eslintrc.cjs
      {
        source: async () =>
          F.pipe(
            await fs.readFile(path.join(folderName, "tsconfig.json"), "utf8"),
            (strContents) =>
              strContents.replaceAll(
                '"extends": "../../tsconfig.base.json"',
                '"extends": "./tsconfig.base.json"',
              ),
          ),
        target: path.join(folderName, "tsconfig.json"),
      },
      {
        source: async () =>
          F.pipe(
            await fs.readFile(path.join(folderName, ".eslintrc.cjs"), "utf8"),
            (strContents) =>
              strContents.replaceAll(
                "require('../../.eslintrc.base.cjs')",
                "require('./.eslintrc.base.cjs')",
              ),
          ),
        target: path.join(folderName, ".eslintrc.cjs"),
      },
      // 4. Copy custom README
      {
        source: path.join(
          ...sourcePathComponentsBase
            .slice(0, -1)
            .concat("customizations", components, "README.md"),
        ),
        target: path.join(folderName, "README.md"),
      },
      // 5. Merge all package.json dependencies (remove anything with "@ty-ras-sample/xyz")
      {
        source: async () => {
          const basePackageJson = F.pipe(
            await fs.readFile(
              path.join(...sourcePathComponentsBase.concat(PACKAGE_JSON)),
              "utf8",
            ),
            JSON.parse,
            parsePackageJson,
          );
          return F.pipe(
            await fs.readFile(path.join(folderName, PACKAGE_JSON), "utf8"),
            JSON.parse,
            parsePackageJsonWithoutWorkspaces,
            ({ dependencies, devDependencies, ...remaining }) => ({
              ...remaining,
              dependencies: Object.fromEntries(
                sortByKey([
                  ...Object.entries(dependencies).filter(
                    ([packageName]) =>
                      !packageName.startsWith("@ty-ras-sample"),
                  ),
                  ...Object.entries(basePackageJson.dependencies),
                ]),
              ),
              devDependencies: Object.fromEntries(
                sortByKey([
                  ...Object.entries(basePackageJson.devDependencies),
                  ...Object.entries(devDependencies),
                ]),
              ),
            }),
            JSON.stringify,
          );
        },
        target: path.join(folderName, PACKAGE_JSON),
      },
    );
  }
  if (packageManager === "pnpm" && components === "be-and-fe") {
    // When we are doing workspace-based setup with pnpm, we must delete 'workspaces' field from package.json,
    // and emit pnpm-workspace.yaml with corresponding content.
    // Apparently supporting 'workspaces' field of package.json is some kind of principal problem:
    // https://github.com/pnpm/pnpm/issues/2255
    // Notice that we can't read the file at packageJsonPath _at this point_, as first copy step is not yet executed.
    const packageJsonPath = path.join(folderName, PACKAGE_JSON);
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
const parsePackageJson = F.pipe(packageJsonWithWorkspaces, S.parseSync);

const PACKAGE_JSON = "package.json";

const getComponentFolderName = (component: "be" | "fe") =>
  component === "be" ? "backend" : "frontend";

const sortByKey = (array: Array<[string, string]>) => {
  array.sort(([xKey], [yKey]) => xKey.localeCompare(yKey));
  return array;
};

// We need this because protocol code has 'import ... from "@ty-ras/protocol";',
// and PNPM requires in this case for the "@ty-ras/protocol" to be in the top-level dependency list.
const createFixPnpmDependencies = (
  dataValidation: string,
): FixPackageJsonDependencies => {
  const dataValidationPackage = `@ty-ras/data-${dataValidation}`;
  return (deps) => {
    const tyrasPackages = Object.keys(deps).filter((packageName) =>
      packageName.startsWith("@ty-ras/"),
    );
    if (tyrasPackages.length > 0) {
      const majorVersionString =
        deps[dataValidationPackage] ??
        getAtLeastMajorVersionString(deps[tyrasPackages[0]]);
      deps = {
        ...deps,
        [dataValidationPackage]:
          deps[dataValidationPackage] ?? majorVersionString,
        [`@ty-ras/protocol`]: majorVersionString,
      };
    }
    return deps;
  };
};

const createFixDevDependencies = (
  components: validatedInput.ValidatedInput["components"],
  info: ServerInfo | undefined,
): FixPackageJsonDependencies | undefined =>
  info === undefined
    ? undefined
    : (devDeps, packageName) =>
        components === "be" || packageName.endsWith("/backend")
          ? {
              ...devDeps,
              [`@types/${info.server}`]: info.typesVersionSpec,
            }
          : devDeps;

const getServerInfo = (server: string): ServerInfo | undefined => {
  switch (server) {
    case "koa":
      return { server, typesVersionSpec: "^2.13.8" };
    case "express":
      return { server, typesVersionSpec: "^4.17.17" };
  }
};

interface ServerInfo {
  server: string;
  typesVersionSpec: string;
}

const getAtLeastMajorVersionString = (versionSpecString: string) =>
  `^${
    /[0-9]+/.exec(versionSpecString)?.[0] ??
    doThrow(`Failed to find major version of TyRAS packages.`)
  }.0.0`;

const doThrow = (msg: string) => {
  throw new Error(msg);
};
