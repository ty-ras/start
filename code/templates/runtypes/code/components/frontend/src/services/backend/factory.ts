/**
 * @file This file contains code exposing the TyRAS api call callback factory.
 */

import * as tyras from "@ty-ras/frontend-__TYRAS_CLIENT__-runtypes";
import config from "../../config";

/**
 * This API call factory will be used by endpoints to create callbacks which invoke backend endpoints in typesafe manner.
 */
export default tyras.createAPICallFactory(config.backend).withHeaders({
  auth: () => {
    // This sample does not have any endpoints requiring authentication.
    throw new Error(
      "Please insert code to retrieve JWT token for any endpoints requiring authentication.",
    );
  },
});
