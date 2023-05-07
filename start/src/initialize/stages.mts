import * as S from "@effect/schema/Schema";
import type * as mi from "../meow-inquirer/index.mjs";
import type * as createTemplate from "../create-template/index.mjs";

const stages = {
  setupGit: {
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
      alias: "g",
    },
  },
} as const satisfies StagesGeneric;

export default stages;

export type DynamicValueInput = createTemplate.ValidatedInput;
export type Stages = typeof stages;
export type StagesGeneric = mi.StagesGeneric<DynamicValueInput>;
export type Stage = mi.Stage<DynamicValueInput>;
export type CommonStage = mi.CommonStage;
export type StateMutatingStage = mi.StateMutatingStage<DynamicValueInput>;
export type MessageStage = mi.MessageStage<DynamicValueInput>;
export type ConditionWithDescription =
  mi.ConditionWithDescription<DynamicValueInput>;
