/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */

/**
 * Transform type
 * ```ts
 * {
 *   key1: data1,
 *   key2: data2,
 *   ...
 * }
 * ```
 * to type
 * ```ts
 * { event: key1, data: data1 }
 * | { event: key2, data: data2 }
 * ...
 * ```
 */
export type ToDiscriminatingTypeUnion<
  TRecord extends {},
  TKeys extends Array<unknown> = TuplifyUnion<keyof TRecord>,
  TAccumulate = never,
> = TKeys extends []
  ? TAccumulate
  : TKeys extends [infer Head, ...infer Tail]
  ? Head extends keyof TRecord
    ? ToDiscriminatingTypeUnion<
        TRecord,
        Tail,
        TAccumulate | { event: Head; data: TRecord[Head] }
      >
    : TAccumulate
  : TAccumulate;

// From: https://stackoverflow.com/questions/55127004/how-to-transform-union-type-to-tuple-type/55128956#55128956
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;
type LastOf<T> = UnionToIntersection<
  T extends any ? () => T : never
> extends () => infer R
  ? R
  : never;

// TS4.0+
type Push<T extends any[], V> = [...T, V];

// TS4.1+
type TuplifyUnion<
  T,
  L = LastOf<T>,
  N = [T] extends [never] ? true : false,
> = true extends N ? [] : Push<TuplifyUnion<Exclude<T, L>>, L>;
