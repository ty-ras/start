import * as F from "@effect/data/Function";
import * as S from "@effect/schema/Schema";
import * as fs from "node:fs/promises";
import { request } from "undici";
import * as semver from "semver";
import type * as events from "./events.mjs";
import packageJson, { type PackageDependencies } from "./package-json.mjs";

export default async (
  onEvent: events.MaybeOnEvent,
  packageJsonPath: string,
  name: string | undefined,
  processDependencies:
    | ((dependencies: PackageDependencies) => PackageDependencies)
    | undefined,
) => {
  // Modify raw version specifications of package.json file into actual versions, which are newest according to version spec
  const {
    devDependencies,
    dependencies,
    name: originalName,
    ...packageJson
  } = F.pipe(
    await fs.readFile(packageJsonPath, "utf8"),
    JSON.parse,
    parsePackageJson,
  );

  const getLatestVersion = createGetLatestVersion(onEvent);

  const newPackageJson = {
    name: name ?? originalName,
    ...packageJson,
    dependencies: Object.fromEntries(
      await Promise.all(
        Object.entries(processDependencies?.(dependencies) ?? dependencies).map(
          getLatestVersion,
        ),
      ),
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

export const parsePackageJson = F.pipe(packageJson, S.parseSync);

const createGetLatestVersion =
  (onEvent: events.MaybeOnEvent) =>
  async ([name, versionSpec]: readonly [string, string]) => {
    let resolvedVersion = versionSpec;
    // Make sure this really is version spec and not fixed version
    // Fixed version happens e.g. in BE&FE template when workspace component references another
    if (!/^\d/.test(versionSpec)) {
      // Resolve version spec
      onEvent?.({
        event: "startReadPackument",
        data: { packageName: name, versionSpec },
      });
      const { versions } = parsePackument(
        await (await request(`https://registry.npmjs.com/${name}`)).body.json(),
      );
      resolvedVersion =
        semver.maxSatisfying(Object.keys(versions), versionSpec) ??
        doThrow(
          `No matching versions found for package "${name}" with version spec "${versionSpec}".`,
        );
      onEvent?.({
        event: "endReadPackument",
        data: { packageName: name, versionSpec, resolvedVersion, versions },
      });
    }
    return [name, resolvedVersion] as const;
  };

const parsePackument = F.pipe(
  S.struct({
    versions: S.record(S.string, S.unknown),
  }),
  S.parseSync,
);

const doThrow = (msg: string) => {
  throw new Error(msg);
};
