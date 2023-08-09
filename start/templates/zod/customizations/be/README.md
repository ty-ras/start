# HTTP Backend with TyRAS Framework

Welcome to TyRAS-oriented Node HTTP server app!
This app is using [`zod`](https://github.com/colinhacks/zod) as data validation framework.
The contents of this folder were created using [`ty-ras/start` npx starter template](https://github.com/ty-ras/meta/tree/main/start).

# Next tasks

As a very first task, it is good idea to pick your favourite testing framework, and write some tests for the code.

As a good second task, one can run development server.
To do that, simply install dependencies (if not already done during project creation stage), and execute `dev` script from `package.json`:
```sh
__PACKAGE_MANAGER__ install && __PACKAGE_MANAGER__ run dev
```

After running the command above, the text `Started server at <host>:<port>` will signal that HTTP server is now listening at given port.

# The code structure

The `src` folder contains all the code.
That folder is further structured in the following way:
- `api` folder contains all code related to HTTP server.
    - `protocol` subfolder contains type definitions related to exposed HTTP endpoints and the data flowing between them.
      This is the core which utilizes some TyRAS interfaces, but mostly it is just defining the endpoint shape using TypeScript types, and data contents using `zod` validators.
    - `endpoints` subfolder contains the code which constructs the endpoints defined by [protocol component](../protocol), using functions and constants provided by TyRAS framework.
    - `index.ts` ties all of the above together to expose `apiEndpoints` constant which contains all endpoints for TyRAS HTTP server to run.
- `auth` folder contains `index.ts`, which can be modified to implement authentication code.
- `config.ts` file contains runtime validator for the configuration of the program.
  It currently only has HTTP server host and port, and CORS settings, but it can easily be expanded to encompass things like DB connection configs, resource pool eviction settings, and so on.
  The development configuration matching this validator is in `config-dev.json` file.
- `index.ts` file is an entrypoint to the program.
  The program will read environment variable `MY_BACKEND_CONFIG` and will try to parse it as inline JSON, or use it as a path to JSON file.
  The resulting JSON object will be validated against what is specified in `config.ts`.
  After this, the TyRAS HTTP server is started.
