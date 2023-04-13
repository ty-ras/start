export const runPoolEvictions = async (poolAdmins) => await Promise.all(poolAdmins.map(runPoolEviction));
const runPoolEviction = async (poolAdmin) => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        // It is enough to check once a minute.
        await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
        // Destroy all connections which have been idle for 10min or more.
        await poolAdmin.runEviction(10 * 60 * 1000)();
    }
};
