# HTTP Backend with TyRAS Framework

This component is a Node HTTP server app.
It is part of the [TyRAS-oriented Node HTTP fullstack app](../../README.md).

# Next tasks

As a very first task, it is good idea to pick your favourite testing framework, and write some tests for the code.

As a good second task, one can run development server.
To do that, simply execute `dev` script from `package.json`:
```sh
__PACKAGE_MANAGER__ run dev
```

After running the command above, the text `Started server at <host>:<port>` will signal that HTTP server is now listening at given port.

Please notice that installing dependencies **must not** be done from *this folder*, instead, it must be done from [main folder](../..).

# The code structure

The `src` folder contains all the code.
That folder is further structured in the following way:
- `api` folder contains all code related to HTTP server.
    - `endpoints` subfolder contains the code which constructs the endpoints defined by [protocol component](../protocol), using functions and constants provided by TyRAS framework.
    - `index.ts` ties all of the above together to expose `apiEndpoints` constant which contains all endpoints for TyRAS HTTP server to run.
- `auth` folder contains `index.ts`, which can be modified to implement authentication code.
- `config.ts` file contains deserialized and validated configuration for the program.
  The deserialization uses `MY_BACKEND_CONFIG` environment variable, which is good idea to change to something else.
  It currently only has HTTP server host and port, and CORS settings, but it can easily be expanded to encompass things like DB connection configs, resource pool eviction settings, and so on.
  The development configuration matching this validator is in `config-dev.json` file.
- `index.ts` file is an entrypoint to the program.
  The program will start the TyRAS HTTP server using configuration in `config.ts` file.
