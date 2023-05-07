import meow, { type AnyFlag, type Result } from "meow";
import * as readPkgUp from "read-pkg-up";
import * as AST from "@effect/schema/AST";
import type * as stages from "./stages";

export default async <TStages extends stages.StagesBase>(
  packageRoot: string,
  stages: TStages,
): Promise<CLIArgs<TStages>> => {
  const { flags, input } = meow(await getHelpText(packageRoot, stages), {
    importMeta: import.meta,
    flags: getFlags(stages),
    booleanDefault: undefined,
    autoVersion: true,
    autoHelp: true,
  });
  return { flags, input };
};

const getFlags = <TStages extends stages.StagesBase>(stages: TStages) =>
  Object.fromEntries(
    Object.entries(stages)
      .filter(
        (
          tuple,
        ): tuple is [
          FlagKeys<TStages>,
          stages.Stage<unknown> & { flag: AnyFlag },
        ] => "flag" in tuple[1],
      )
      .map(([key, { flag }]) => [key, flag] as const),
  ) as Flags<TStages>;

export interface CLIArgs<TStages extends stages.StagesBase> {
  input: ReadonlyArray<string>;
  flags: Partial<Result<Flags<TStages>>["flags"]>;
}

export type Flags<TStages extends stages.StagesBase> = {
  [P in FlagKeys<TStages>]: TStages[P] extends { flag: AnyFlag }
    ? TStages[P]["flag"]
    : never;
};

export type FlagKeys<TStages extends stages.StagesBase> = {
  [P in keyof TStages]: TStages[P] extends { flag: AnyFlag } ? P : never;
}[keyof TStages] &
  string;

const schemaToHelpText = (ast: AST.AST): string => {
  switch (ast._tag) {
    case "Union":
      return ast.types.map(schemaToHelpText).join("|");
    case "Literal":
      return typeof ast.literal === "string"
        ? `"${ast.literal}"`
        : `${ast.literal}`;
    case "BooleanKeyword":
      return "boolean";
    default:
      throw new Error(`Unrecognized AST: ${ast._tag}`);
  }
};

const getHelpText = async <TStages extends stages.StagesBase>(
  packageRoot: string,
  stages: TStages,
) => `
  Usage: npx ${
    (await readPkgUp.readPackageUp({ cwd: packageRoot }))?.packageJson.name
  }@latest [options...] [folder]

  All options and folder are optional as command-line arguments.
  If any of them is omitted, the program will prompt for their values.
  Options:
    ${Object.entries(stages)
      .filter(
        (
          tuple,
        ): tuple is [
          string,
          stages.CommonStage &
            stages.StateMutatingStage<unknown> & { flag: AnyFlag },
        ] => "flag" in tuple[1],
      )
      .map(
        ([
          name,
          {
            flag: { alias },
            prompt: { message },
            schema,
            condition,
          },
        ]) =>
          `--${name}, -${alias}\t${message}${
            condition === undefined
              ? ""
              : `\n          ${condition.description}`
          }\n          Schema: ${schemaToHelpText(schema.ast)}`,
      )
      .join("\n    ")}
`;
