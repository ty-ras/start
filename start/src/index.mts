import chalk from "chalk";
import gradientString from "gradient-string";
import ora from "ora";
import * as F from "@effect/data/Function";
import * as Set from "@effect/data/HashSet";
import * as Match from "@effect/match";
import * as common from "./common.mjs";
import * as collectInput from "./collect-input.mjs";
import * as createTemplate from "./create-template.mjs";

// eslint-disable-next-line sonarjs/cognitive-complexity
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
  let input: collectInput.InputFromCLIOrUser = {};
  let validatedInput: createTemplate.ValidatedInput | undefined;
  do {
    // Get the inputs from CLI args or user prompt
    // On first loop, the 'input' will be empty and all the things will be checked/asked.
    // On subsequent loops (if any), only the errored properties will be missing, and thus checked/asked again.
    const cliArgsSet: Set.HashSet<collectInput.CLIArgsInfoSetElement> =
      await collectInput.collectInputs(cliArgs, input);
    // Validate the inputs in a way that template creation part knows
    const validationResult = await createTemplate.validateInput(input);
    if (Array.isArray(validationResult)) {
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
    } else if (typeof validationResult === "string") {
      // This signifies internal error, as at this point the input itself is structurally invalid
      // Clear everything and start asking from clean slate
      common.print(
        chalk.red(
          `There has been an internal error when collecting input.\nIgnoring all CLI flags from now on, and starting to collect input from beginning.\nError message: ${validationResult}`,
        ),
      );
      cliArgs = { flags: {}, input: [] };
      input = {};
    } else {
      validatedInput = validationResult;
    }
  } while (validatedInput === undefined);
  common.print(`THE STATE:\n${JSON.stringify(input, undefined, 2)}`);
  // TODO start ora spinner here
  const spinner = ora("Beginning template creation").start();
  let success = false;
  try {
    await createTemplate.writeProjectFiles({
      validatedInput,
      onEvent: (evt) => {
        spinner.text = F.pipe(
          Match.value(evt),
          Match.when(
            { event: "startCopyTemplateFiles" },
            () => "Starting to copy template files",
          ),
          Match.when(
            { event: "startFixPackageJsonVersions" },
            () => "Fixing package.json versions",
          ),
          Match.when(
            { event: "startReadPackument" },
            ({ data: { packageName, versionSpec } }) =>
              `Fetching packument for "${packageName}" and version spec "${versionSpec}".`,
          ),
          Match.when(
            { event: "endReadPackument" },
            ({ data: { packageName, resolvedVersion, versions } }) =>
              `For "${packageName}", resolved version "${resolvedVersion}" from ${
                Object.keys(versions).length
              } total versions`,
          ),
          Match.orElse(() => ""),
        );
      },
    });
    success = true;
  } finally {
    if (success) {
      spinner.succeed("Project created!");
    } else {
      spinner.fail(
        "Project creation failed, please see error message for more information.",
      );
    }
  }
};

const gradient = gradientString("#0070BB", "#FEBE10", "#BC3F4A");
