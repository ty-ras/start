import * as fs from "node:fs/promises";
import * as fse from "fs-extra";

// Notice that instructions are executed sequentially, not in parallel!
export default async (instructions: CopyInstructions) => {
  for (const { source, target } of instructions) {
    if (typeof source === "string") {
      // Normal copy from one path to another
      await fse.copy(source, target);
    } else {
      // Write dynamically generated content to path
      await fs.writeFile(target, await source(), "utf8");
    }
  }
};

export interface CopyInstruction {
  source: // Path to file
  | string
    // Dynamically generated file contents
    | (() => string | Promise<string>);

  // Path to file
  target: string;
}

export type CopyInstructions = ReadonlyArray<CopyInstruction>;
