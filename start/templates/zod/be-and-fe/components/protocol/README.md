# HTTP Protocol Specification with TyRAS Framework

This component is a protocol specification for backend and frontend to use.
It is part of the [TyRAS-oriented Node HTTP fullstack app](../../README.md).
It is not meant to be executed as standalone component, but rather it is a library to be used when communicating via HTTP protocol - to define the endpoints and the shape of the data being transferred.

Please notice that installing dependencies **must not** be done from *this folder*, instead, it must be done from [main folder](../..).

# The code structure

The `src` folder contains all the code.
That folder is further structured in the following way:
- `hello` folder contains code related to `/api/greeting` endpoint - just to give one idea on how actual endpoint specifications can be implemented:
    - `data.ts` file contains `zod` validators for all the input and output data used in the endpoint,
    - `endpoints.ts` file contains type definitions which describe the HTTP endpoints to be exposed by this logical unit of the whole API, and
    - `index.ts` ties it all together by exposing the endpoint type definitions directly, and data validators behind the `data` alias.
- `index.ts` re-exports all the `index.ts` files of all the subfolders there is.

Notice that the `package.json` contains the `main`, `types`, and `module` entries, since this component is imported by other components.
