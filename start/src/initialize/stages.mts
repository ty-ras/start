import * as S from "@effect/schema/Schema";
import type * as stageTypes from "../stages";
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
export type StagesGeneric = stageTypes.StagesGeneric<DynamicValueInput>;
export type Stage = stageTypes.Stage<DynamicValueInput>;
export type CommonStage = stageTypes.CommonStage;
export type StateMutatingStage =
  stageTypes.StateMutatingStage<DynamicValueInput>;
export type MessageStage = stageTypes.MessageStage<DynamicValueInput>;
export type ConditionWithDescription =
  stageTypes.ConditionWithDescription<DynamicValueInput>;
