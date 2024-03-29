import chalk from "chalk";
import gradientString from "gradient-string";
import ora from "ora";
import * as F from "@effect/data/Function";
import * as Match from "@effect/match";
import * as createTemplate from "./write/index.mjs";
import * as initialize from "./initialize/index.mjs";
import * as mi from "meow-inquirer";

export default async () => {
  const { cliArgs, packageRoot } = await mi.createCLIArgs({
    inputSpec: {
      ...createTemplate.inputSpec,
      ...initialize.inputSpec,
    },
    importMeta: import.meta,
  });

  // At this point, program would've exited if there was --help or --version specified
  // Since we are still here, continue with printing welcome message
  printWelcomeMessage();

  const writeProjectFilesInput = await collectInputForWriting({
    cliArgs,
    getDynamicValueInput: (values) => values.components,
    inputValidator: createTemplate.validateInput,
  });
  // Now that the mandatory input is collected and validated, write project files
  await writeProjectFilesWithSpinner(packageRoot, writeProjectFilesInput);

  // Proceed to prompt the user for that
  let initializeInput: initialize.ValidatedInput | undefined;
  try {
    initializeInput = await collectInputForInitializing({
      cliArgs,
      getDynamicValueInput: () => writeProjectFilesInput,
      inputValidator: initialize.validateInput,
    });
  } catch (error) {
    // This can happen e.g. when all mandatory arguments are provided via CLI parameters
    // and stdin is /dev/null .
    if (!isTTYError(error)) {
      throw error;
    }
  }

  if (initializeInput) {
    await initialize.initialize(writeProjectFilesInput, initializeInput);
  }

  // We are done!
  mi.print(
    chalk.whiteBright(
      `Project creation succeeded!\nPlease take a look in the README file within folder "${writeProjectFilesInput.folderName}" for short information on how to proceed.`,
    ),
  );
};

const collectInputForWriting = mi.collectInput(createTemplate.inputSpec);
const collectInputForInitializing = mi.collectInput(initialize.inputSpec);

const gradient = gradientString("#0070BB", "#FEBE10", "#BC3F4A");

const printWelcomeMessage = () => {
  mi.print(
    chalk.bold(`\n${gradient("TyRAS")} - Typesafe REST API Specification`),
  );
  mi.print(
    chalk.italic(
      "This program will create new project to work with HTTP backend and/or frontend utilizing TyRAS libraries.\n",
    ),
  );
};

const writeProjectFilesWithSpinner = async (
  packageRoot: string,
  validatedInput: createTemplate.ValidatedInput,
) => {
  mi.print(
    chalk.bgGray(
      `Creating project to folder "${validatedInput.folderName}" with components "${validatedInput.components}".`,
    ),
  );
  const spinner = ora("Beginning template creation").start();
  let success = false;
  try {
    await createTemplate.writeFiles({
      validatedInput,
      packageRoot,
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
          Match.when(
            { event: "startProcessingFileContents" },
            () => "Starting to replace placeholders",
          ),
          Match.when(
            { event: "endProcessingFileContents" },
            ({ data: { paths } }) =>
              `Replaced placeholders from ${paths.size} files`,
          ),
          Match.orElse(() => ""),
        );
      },
    });
    success = true;
  } finally {
    if (success) {
      spinner.succeed("Project created.");
    } else {
      spinner.fail(
        "Project creation failed, please see error message for more information.",
      );
    }
  }
};

const isTTYError = (error: unknown) =>
  error instanceof Error && "isTtyError" in error && error.isTtyError === true;
