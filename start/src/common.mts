export const print = (msg: string, level: "log" | "warn" | "error" = "log") =>
  // eslint-disable-next-line no-console
  console[level](msg);
