/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import * as F from "@effect/data/Function";
import * as O from "@effect/data/Option";
import * as E from "@effect/data/Either";
import * as A from "@effect/data/ReadonlyArray";
import * as S from "@effect/schema/Schema";
import * as TF from "@effect/schema/TreeFormatter";
import * as Match from "@effect/match";
import * as collectInput from "./collect-input.mjs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as fse from "fs-extra";
import { request } from "undici";
import * as semver from "semver";
import type * as types from "./types";

export const writeProjectFiles = async ({
  validatedInput: { folderName, dataValidation, components },
  onEvent,
}: Input) => {
  // Copy all files first
  onEvent?.({ event: "startCopyTemplateFiles", data: {} });
  await fse.copy(
    path.join(
      new URL(import.meta.url).pathname,
      "..",
      "..",
      "templates",
      dataValidation,
      components,
    ),
    folderName,
  );
  onEvent?.({ event: "endCopyTemplateFiles", data: {} });

  // Now, fix all version specs of all package.json files into actual versions.
  onEvent?.({ event: "startFixPackageJsonVersions", data: {} });

  // Start by finding all package.json files
  const packageJsonPaths = await getAllPackageJsonPaths(folderName);
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

  // We are done!
};

export const validateInput = (
  input: collectInput.InputFromCLIOrUser,
):
  | string
  | Promise<
      | ValidatedInput
      | Array<readonly [keyof collectInput.InputFromCLIOrUser, string]>
    > =>
  F.pipe(
    input,
    inputSchemaDecoder,
    E.mapLeft(({ errors }) => TF.formatErrors(errors)),
    Match.value,
    Match.when(E.isLeft, ({ left }) => left),
    Match.orElse(({ right: validatedInput }) =>
      invokeValidators(validatedInput),
    ),
  );

export interface Input {
  validatedInput: ValidatedInput;
  onEvent?: OnEvent;
}

export type ValidatedInput = S.To<typeof inputSchema>;

export type OnEvent = (evt: EventArgument) => void;
type MaybeOnEvent = OnEvent | undefined;
export type EventArgument = types.ToDiscriminatingTypeUnion<EventsPayloads>;

const invokeValidators = (input: Readonly<ValidatedInput>) =>
  F.pipe(
    Object.entries(input) as ReadonlyArray<
      [
        keyof ValidatedInput,
        Exclude<ValidatedInput[keyof ValidatedInput], undefined>,
      ]
    >,
    (entries) =>
      entries.map(
        async ([valueName, value]) =>
          [
            valueName,
            await F.pipe(
              value,
              S.decodeEither(
                collectInput.stages[valueName].schema as S.Schema<any>,
              ),
              async (result) => {
                try {
                  return E.isLeft(result)
                    ? O.some(TF.formatErrors(result.left.errors))
                    : (await validators[valueName]?.(value as never)) ??
                        O.none();
                } catch (err) {
                  return O.some(
                    err instanceof Error
                      ? `${err.name}: ${err.message}`
                      : `${err}`,
                  );
                }
              },
            ),
          ] as const,
      ),
    async (promises) =>
      F.pipe(
        await Promise.all(promises),
        A.filterMap(([valueName, validationResult]) =>
          F.pipe(
            validationResult,
            O.map((errorMessage) => [valueName, errorMessage] as const),
          ),
        ),
      ),
    async (validationErrors) =>
      (await validationErrors).length > 0 ? validationErrors : input,
  );

const validators: Partial<{
  [P in keyof ValidatedInput]: (
    value: Exclude<ValidatedInput[P], undefined>,
  ) => Promise<O.Option<string>>;
}> = {
  folderName: async (folderName) => {
    await fs.mkdir(folderName, { recursive: true });
    return (await fs.readdir(folderName)).length > 0
      ? O.some("Target directory not empty!")
      : O.none();
  },
};

const pickSchemas = <TKeys extends Array<collectInput.SchemaKeys>>(
  ...keys: TKeys
): { [P in TKeys[number]]: collectInput.Stages[P]["schema"] } =>
  Object.fromEntries(
    Object.entries(collectInput.stages)
      .filter(
        (
          entry,
        ): entry is [
          collectInput.SchemaKeys,
          collectInput.Stages[collectInput.SchemaKeys],
        ] => keys.indexOf(entry[0] as collectInput.SchemaKeys) >= 0,
      )
      .map(([key, stage]) => [key, stage.schema] as const),
  ) as { [P in TKeys[number]]: collectInput.Stages[P]["schema"] };

// No intersections yet in @effect/schema I think...
const inputSchema = F.pipe(
  F.pipe(
    S.struct(pickSchemas("folderName", "dataValidation")),
    S.identifier("GeneralProperties"),
  ),
  S.extend(
    S.union(
      F.pipe(
        S.struct({
          components: S.literal("fe"),
          ...pickSchemas(
            // FE properties
            "client",
            // "extrasInFrontend",
          ),
        }),
        S.identifier("FrontendProperties"),
      ),
      F.pipe(
        S.struct({
          components: S.literal("be"),
          ...pickSchemas(
            // BE properties
            "server",
            // "extrasInBackend",
          ),
        }),
        S.identifier("BackendProperties"),
      ),
      F.pipe(
        S.struct({
          components: S.literal("be-and-fe"),
          ...pickSchemas(
            // FE properties
            "client",
            // "extrasInFrontend",
            // BE properties
            "server",
            // "extrasInBackend",
          ),
        }),
        S.identifier("BackendAndFrontendProperties"),
      ),
    ),
  ),
);

// We must use parseEither instead of decodeEither
// This is because parseEither always takes unknown as input parameter
// The decodeEither takes schema input type as input parameter -> in this case, it will be something else than unknown
const inputSchemaDecoder = S.parseEither(inputSchema);

export interface EventsPayloads {
  startCopyTemplateFiles: {};
  endCopyTemplateFiles: {};
  startFixPackageJsonVersions: {};
  startReadPackument: { packageName: string; versionSpec: string };
  endReadPackument: {
    packageName: string;
    versionSpec: string;
    resolvedVersion: string;
    versions: Record<string, unknown>;
  };
  endFixPackageJsonVersions: { packageJsonPaths: ReadonlyArray<string> };
}

const parsePackageJson = F.pipe(
  S.record(S.string, S.unknown),
  S.extend(
    S.struct({
      dependencies: S.record(S.string, S.string),
      devDependencies: S.record(S.string, S.string),
    }),
  ),
  S.parse,
);

const materializePackageJson = async (
  onEvent: MaybeOnEvent,
  packageJsonPath: string,
  name: string,
) => {
  // Modify raw version specifications of package.json file into actual versions, which are newest according to version spec
  const { devDependencies, dependencies, ...packageJson } = F.pipe(
    await fs.readFile(packageJsonPath, "utf8"),
    JSON.parse,
    parsePackageJson,
  );
  const getLatestVersion = getLatestVersionWithEvents(onEvent);

  const newPackageJson = {
    name,
    ...packageJson,
    dependencies: Object.fromEntries(
      await Promise.all(Object.entries(dependencies).map(getLatestVersion)),
    ),
    devDependencies: Object.fromEntries(
      await Promise.all(Object.entries(devDependencies).map(getLatestVersion)),
    ),
  };

  await fs.writeFile(
    packageJsonPath,
    JSON.stringify(newPackageJson, undefined, 2),
    "utf8",
  );
};

const getLatestVersionWithEvents =
  (onEvent: MaybeOnEvent) =>
  async ([name, versionSpec]: readonly [string, string]) => {
    onEvent?.({
      event: "startReadPackument",
      data: { packageName: name, versionSpec },
    });
    const { versions } = parsePackument(
      await (await request(`https://registry.npmjs.com/${name}`)).body.json(),
    );
    const resolvedVersion =
      semver.maxSatisfying(Object.keys(versions), versionSpec) ??
      doThrow(
        `No matching versions found for package "${name}" with version spec "${versionSpec}".`,
      );
    onEvent?.({
      event: "endReadPackument",
      data: { packageName: name, versionSpec, resolvedVersion, versions },
    });
    return [name, resolvedVersion] as const;
  };

const doThrow = (msg: string) => {
  throw new Error(msg);
};

const parsePackument = F.pipe(
  S.struct({
    versions: S.record(S.string, S.unknown),
  }),
  S.parse,
);

type ExtractPackageName = (packageJsonPath: string) => string;

// We export this only for tests
export const getAllPackageJsonPaths = async (rootDir: string) => {
  const packageJsonPaths: Array<string> = [];
  for await (const filePath of readDirRecursive(rootDir)) {
    if (path.basename(filePath) === "package.json") {
      packageJsonPaths.push(filePath);
    }
  }
  return packageJsonPaths;
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
