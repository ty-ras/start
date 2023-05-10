import * as S from "@effect/schema/Schema";
import * as mi from "meow-inquirer";
import type * as createTemplate from "../write/index.mjs";

const inputSpec = {
  setupGit: {
    type: mi.TYPE_VALIDATE,
    orderNumber: 0,
    schema: S.boolean,
    prompt: {
      type: "confirm",
      message: "Should the project folder be initialized with Git?",
      default: false,
    },
    flag: {
      type: "boolean",
      isRequired: false,
      shortFlag: "g",
    },
  },
} as const satisfies StagesGeneric;

export default inputSpec;

export type DynamicValueInput = createTemplate.ValidatedInput;
export type Stages = typeof inputSpec;
export type StagesGeneric = mi.InputSpec<DynamicValueInput>;
export type Stage = mi.InputSpecProperty<DynamicValueInput>;
export type StateMutatingStage = mi.ValidationSpec<DynamicValueInput>;
export type MessageStage = mi.MessageSpec<DynamicValueInput>;
export type ConditionWithDescription =
  mi.ConditionWithDescription<DynamicValueInput>;
