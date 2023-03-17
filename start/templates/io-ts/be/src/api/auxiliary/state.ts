import { function as F, taskEither as TE } from "fp-ts";
import * as tt from "io-ts-types";
import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import * as services from "../../services";
import { state, resources } from "@ty-ras-extras/backend-io-ts";
import type * as userId from "./user-id";
import type * as userRegistration from "./user-registration";
import type * as permissions from "./permissions";

export const authenticationStateValidators = {
  // User ID is for DB
  userId: services.uuidValidation("UserID"),
} as const;

export const authenticatedStateSpec = tyras.transformEntries(
  authenticationStateValidators,
  () => true as const,
);

export class PermissionsClass {
  public constructor(
    public readonly checkPermissions: permissions.CheckUserPermissions,
    public readonly invalidatePermissions: permissions.InvalidatePermissions,
  ) {}
}

export const PERMISSIONS_PROPERTY = "permissions";

export class DatabaseForOrg {
  public constructor(
    public readonly db: resources.ResourcePool<
      {
        client: services.DBClient;
        currentOrgID: string;
      },
      string
    >,
  ) {}

  public bindToOrganizationID(organizationID: string): services.DBPool {
    return {
      acquire: () =>
        F.pipe(
          this.db.acquire(organizationID),
          TE.map(({ client }) => client),
        ),
      release: (client) =>
        this.db.release({ client, currentOrgID: organizationID }),
    };
  }
}

export const DB_PROPERTY = "db";

export class UserIdCacheClass {
  public constructor(public readonly cache: userId.UserIDCache) {
    // Nothing to do in constructor
  }
}

export const USER_ID_CACHE_PROPERTY = "userIdCache";

export class UserRegistrationClass {
  public constructor(
    public readonly cache: userRegistration.UserRegistration,
  ) {}
}

export const USER_REGISTRATION_PROPERTY = "userRegistration";

export const additionalStateValidators = {
  [PERMISSIONS_PROPERTY]: tyras.instanceOf(
    PermissionsClass,
    "PermissionsClass",
  ),
  [USER_ID_CACHE_PROPERTY]: tyras.instanceOf(
    UserIdCacheClass,
    "UserIDCacheClass",
  ),
  [USER_REGISTRATION_PROPERTY]: tyras.instanceOf(
    UserRegistrationClass,
    "UserRegistrationClass",
  ),
} as const;

export const endpointState = state.createStateValidatorFactory(
  state.getFullStateValidationInfo(authenticationStateValidators, {
    [DB_PROPERTY]: tyras.instanceOf(DatabaseForOrg, "DatabaseOrgUser"),
    ...additionalStateValidators,
  }),
);

export type FullStateValidationInfo = state.GetStateValidationInfo<
  typeof endpointState
>;

export type State = state.GetFullState<FullStateValidationInfo>;
export type AuthenticatedState = Pick<
  State,
  keyof typeof authenticatedStateSpec
>;

export type StateInfo<T = keyof State> = ReadonlyArray<T>;

export type TStateSpecBase = state.StateSpec<FullStateValidationInfo>;

export type GetState<TStateSpec> = state.GetState<
  FullStateValidationInfo,
  TStateSpec
>;
