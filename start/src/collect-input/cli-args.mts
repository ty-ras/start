import meow, { type AnyFlag, type Result } from "meow";
import * as readPkgUp from "read-pkg-up";
import * as AST from "@effect/schema/AST";
import stages, {
  type StagesGeneric,
  type Stages,
  type Stage,
  type CommonStage,
  type StateMutatingStage,
} from "./stages.mjs";

export default (): CLIArgs => {
  const { flags, input } = meow(help, {
    importMeta: import.meta,
    flags: getFlags(),
    booleanDefault: undefined,
    autoVersion: true,
    autoHelp: true,
  });
  return { flags, input };
};

const getFlags = (): Flags => {
  return Object.fromEntries(
    Object.entries(stages as StagesGeneric)
      .filter(
        (tuple): tuple is [FlagKeys, Stage & { flag: AnyFlag }] =>
          "flag" in tuple[1],
      )
      .map(([key, { flag }]) => [key, flag] as const),
  ) as Flags;
};

export interface CLIArgs {
  input: ReadonlyArray<string>;
  flags: Partial<Result<Flags>["flags"]>;
}

export type Flags = {
  [P in FlagKeys]: Stages[P]["flag"];
};

export type FlagKeys = {
  [P in keyof Stages]: Stages[P] extends { flag: AnyFlag } ? P : never;
}[keyof Stages];

const schemaToHelpText = (ast: AST.AST): string => {
  switch (ast._tag) {
    case "Union":
      return ast.types.map(schemaToHelpText).join("|");
    case "Literal":
      return typeof ast.literal === "string"
        ? `"${ast.literal}"`
        : `${ast.literal}`;
    default:
      throw new Error(`Unrecognized AST: ${ast._tag}`);
  }
};

const help = `
  Usage: npx ${
    (await readPkgUp.readPackageUp())?.packageJson.name
  } [options...] [folder]

  All options and folder are optional as command-line arguments.
  If any of them is omitted, the program will prompt for their values.
  Options:
    ${Object.entries(stages as StagesGeneric)
      .filter(
        (
          tuple,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        ): tuple is [
          string,
          CommonStage & StateMutatingStage & { flag: AnyFlag },
        ] =>
          // This comment is only to make function body be on different line
          "flag" in tuple[1],
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
