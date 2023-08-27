import * as F from "@effect/data/Function";
import * as A from "@effect/data/ReadonlyArray";
import * as fs from "node:fs/promises";

export default async (
  instructions: ReadonlyArray<ReplaceFileContentsInstruction>,
) => {
  const modifiedPaths: Set<string> = new Set();
  for (const { filePath, replacementData } of instructions) {
    await F.pipe(
      await fs.readFile(filePath, "utf8"),
      (originalContents) => ({
        originalContents,
        newContents: F.pipe(
          replacementData,
          A.reduce(
            originalContents,
            (curContents, { searchFor, replaceWith }) =>
              curContents.replaceAll(searchFor, replaceWith),
          ),
        ),
      }),
      ({ originalContents, newContents }) =>
        originalContents === newContents
          ? Promise.resolve()
          : (modifiedPaths.add(filePath),
            fs.writeFile(filePath, newContents, "utf8")),
    );
  }

  return modifiedPaths;
};

export interface ReplaceFileContentsInstruction {
  filePath: string;
  replacementData: ReadonlyArray<FileContentsReplacement>;
}

export interface FileContentsReplacement {
  searchFor: string;
  replaceWith: string;
}
