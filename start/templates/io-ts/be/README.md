# HTTP Backend with TyRAS Framework

Welcome to TyRAS-oriented Node HTTP server app!
This app is using [`io-ts`](https://github.com/gcanti/io-ts) as data validation framework.
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
      This is the core which utilizes some TyRAS interfaces, but mostly it is just defining the endpoint shape using TypeScript types, and data contents using `io-ts` validators.
    - `auxiliary` subfolder contains the utility code, used when constructing HTTP server containing endpoints defined by `protocol` folder.
      The only file most likely needing to be customized as application evolves, is `state.ts`.
    - `endpoints` subfolder contains the code which constructs the endpoints defined by `protocol` folder, using functions and constants provided by TyRAS framework, and also utilizing code in `auxiliary` folder.
    - `index.ts` ties all of the above together to expose `apiEndpoints` constant which contains all endpoints for TyRAS HTTP server to run.
- `environment` folder contains API for the environment where the HTTP server is running.
  In this sample it contains only the API and no implementation, but it can be expanded to contain e.g. cloud-provider-specific (AWS/Azure/GCP/etc) things like bearer token verification, access to some storage (S3/Storage Account/etc), etc.
- `services` folder contains all the code related to business logic, but not to HTTP server.
  In this sample it is close to non-existing, but it can be easily expanded to contain actual business logic.
- `execution` folder contains generic code related to running the HTTP server.
  It is used by the component entrypoint to run the server + any additional things related to it (e.g. periodic resource pool evictions).
- `config.ts` file contains runtime validator for the configuration of the program.
  It currently only has HTTP server host and port, and CORS settings, but it can easily be expanded to encompass things like DB connection configs, resource pool eviction settings, and so on.
  The development configuration matching this validator is in `config-dev.json` file.
- `index.ts` file is an entrypoint to the program.
  The program will read environment variable `MY_BACKEND_CONFIG` and will try to parse it as inline JSON, or use it as a path to JSON file.
  The resulting JSON object will be validated against what is specified in `config.ts`.
  After this, the necessary elements like environment and API endpoints are passed on to code in `execution` folder, where the HTTP server and other aspects will be started.
