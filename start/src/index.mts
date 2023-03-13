import chalk from "chalk";
import gradientString from "gradient-string";
import * as collectInput from "./collect-input.mjs";
import * as common from "./common.mjs";

export default async () => {
  const input = await collectInput.collectInputs(() => {
    common.print(chalk.bold(gradient("\nTyRAS\n")));
    common.print(
      chalk.italic(
        "This program will create new project to work with HTTP backend and/or frontend utilizing TyRAS libraries.\n",
      ),
    );
  });
  common.print(`THE STATE:\n${JSON.stringify(input, undefined, 2)}`);
};

const gradient = gradientString("#0070BB", "#FEBE10", "#BC3F4A");
