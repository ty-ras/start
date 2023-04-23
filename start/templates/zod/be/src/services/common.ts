import * as t from "zod";

// This is RFC-adhering UUID regex. Relax if needed.
// Taken from https://stackoverflow.com/questions/7905929/how-to-test-valid-uuid-guid
// Notice: We don't use string start/end markers HERE, because this regex will also be used in URL validation.
export const uuidRegex =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export const uuidRegexFullString = new RegExp(`^${uuidRegex.source}$`, "i");

export const uuidValidation = (name: string) =>
  t
    .string()
    .refine((str) => uuidRegexFullString.test(str))
    .describe(name);

export const UUID_ZEROES = "00000000-0000-0000-0000-000000000000";
