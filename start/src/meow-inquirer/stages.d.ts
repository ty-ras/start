import type * as S from "@effect/schema/Schema";
import { type AnyFlag } from "meow";
import { type DistinctQuestion } from "inquirer";

export type StagesGeneric<TDynamicValueInput> = Record<
  string,
  Stage<TDynamicValueInput>
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StagesBase = StagesGeneric<any>;

export type Stage<TDynamicValueInput> = CommonStage &
  (StateMutatingStage<TDynamicValueInput> | MessageStage<TDynamicValueInput>);

export interface CommonStage {
  orderNumber: number;
}

export interface StateMutatingStage<TDynamicValueInput> {
  prompt: DistinctQuestion;
  flag?: AnyFlag;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: S.Schema<any>;
  condition?: ConditionWithDescription<TDynamicValueInput>;
}

export interface ConditionWithDescription<TDynamicValueInput> {
  description: string;
  isApplicable: DynamicValue<TDynamicValueInput, boolean>;
}

export interface MessageStage<TDynamicValueInput> {
  message: string | DynamicValue<TDynamicValueInput, string | undefined>;
}

export type DynamicValue<TInput, TOutput> = (input: TInput) => TOutput;

export type GetDynamicValueInput<TSTages extends StagesBase> =
  TSTages extends StagesGeneric<infer TDynamicValueInput>
    ? TDynamicValueInput
    : never;
