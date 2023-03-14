import chalk from "chalk";
import gradientString from "gradient-string";
import * as Set from "@effect/data/HashSet";
import * as common from "./common.mjs";
import * as collectInput from "./collect-input.mjs";
import * as createTemplate from "./create-template.mjs";

export default async () => {
  let cliArgs: collectInput.CLIArgsInfo = collectInput.createCLIArgs();
  // At this point, program would've exited if there was --help or --version specified
  // Since we are still here, continue with printing welcome message
  common.print(chalk.bold(gradient("\nTyRAS\n")));
  common.print(
    chalk.italic(
      "This program will create new project to work with HTTP backend and/or frontend utilizing TyRAS libraries.\n",
    ),
  );
  // Then, collect the inputs - use CLI args or prompt from user
  // Keep collecting until all inputs pass validation
  const input: collectInput.InputFromCLIOrUser = {};
  let isInvalid: boolean;
  do {
    // Get the inputs from CLI args or user prompt
    // On first loop, the 'input' will be empty and all the things will be checked/asked.
    // On subsequent loops (if any), only the errored properties will be missing to be checked/asked again.
    const cliArgsSet: Set.HashSet<collectInput.CLIArgsInfoSetElement> =
      await collectInput.collectInputs(cliArgs, input);
    // Validate the inputs in a way that template creation part knows
    const validationResult = await createTemplate.validateInput(input);
    // The result will be empty if no errors
    isInvalid = validationResult.length > 0;
    if (isInvalid) {
      // When there are errors, notify user and adjust 'input' variable.
      for (const [valueName, errorMessage] of validationResult) {
        // Notify user about the error
        common.print(
          chalk.redBright(`Error for "${valueName}":\n${errorMessage}\n`),
        );
        // Delete it so that collectInputs would ask for it again
        delete input[valueName];
      }
      if (!Set.isHashSet(cliArgs)) {
        cliArgs = cliArgsSet;
      }
    }
  } while (isInvalid);
  common.print(`THE STATE:\n${JSON.stringify(input, undefined, 2)}`);
};

const gradient = gradientString("#0070BB", "#FEBE10", "#BC3F4A");
