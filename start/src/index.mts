import chalk from "chalk";
import gradientString from "gradient-string";
import ora from "ora";
import * as F from "@effect/data/Function";
import * as Match from "@effect/match";
import * as path from "node:path";
import * as url from "node:url";
import * as createTemplate from "./create-template/index.mjs";
import * as initialize from "./initialize/index.mjs";
import * as mi from "./meow-inquirer/index.mjs";

// eslint-disable-next-line sonarjs/cognitive-complexity
export default async () => {
  const cliArgs = await mi.createCLIArgs<
    createTemplate.Stages | initialize.Stages
  >(packageRoot, {
    ...createTemplate.inputSpec,
    ...initialize.stages,
  });

  // At this point, program would've exited if there was --help or --version specified
  // Since we are still here, continue with printing welcome message
  printWelcomeMessage();

  // Collect any missing input (not passed via command-line arguments) by prompting the user
  const validatedInput = await mi.collectInput(createTemplate.inputSpec)(
    cliArgs,
    "components",
    createTemplate.validateInput,
  );
  // Now that the mandatory input is collected and validated, write project files
  await writeProjectFilesWithSpinner(validatedInput);
  // If there is missing input, and stdin is available, proceed to prompt the user for that
  // TODO
  // At this point, we are done
  mi.print(
    chalk.whiteBright(
      `Project creation succeeded!\nPlease take a look in the README file within folder "${validatedInput.folderName}" for short information on how to proceed.`,
    ),
  );
};

const gradient = gradientString("#0070BB", "#FEBE10", "#BC3F4A");

const packageRoot = F.pipe(
  path.join(
    // From: https://blog.logrocket.com/alternatives-dirname-node-js-es-modules/
    url.fileURLToPath(new URL(".", import.meta.url)),
    "..",
  ),
  path.normalize,
);

const printWelcomeMessage = () => {
  mi.print(chalk.bold(gradient("\nTyRAS\n")));
  mi.print(
    chalk.italic(
      "This program will create new project to work with HTTP backend and/or frontend utilizing TyRAS libraries.\n",
    ),
  );
};

const writeProjectFilesWithSpinner = async (
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
            { event: "startFixingPackageNames" },
            () => "Starting to fix package names",
          ),
          Match.when(
            { event: "fixedPackageName" },
            ({ data: { path } }) => `Fixed package names from ${path}`,
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
