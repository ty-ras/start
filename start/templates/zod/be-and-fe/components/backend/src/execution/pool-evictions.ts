import type { resources } from "@ty-ras-extras/backend-zod";

export const runPoolEvictions = async (
  poolAdmins: ResourcePoolAdministrations,
) => await Promise.all(poolAdmins.map(runPoolEviction));

const runPoolEviction = async (
  poolAdmin: resources.ResourcePoolAdministration<unknown>,
) => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // It is enough to check once a minute.
    await new Promise<void>((resolve) => setTimeout(resolve, 60 * 1000));
    // Destroy all connections which have been idle for 10min or more.
    await poolAdmin.runEviction(10 * 60 * 1000)();
  }
};

export type ResourcePoolAdministrations = ReadonlyArray<
  resources.ResourcePoolAdministration<unknown>
>;
