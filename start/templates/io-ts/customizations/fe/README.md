# HTTP Frontend with TyRAS Framework

Welcome to TyRAS-oriented Vite-powered React app!
This app is using [`io-ts`](https://github.com/gcanti/io-ts) as data validation framework.
The contents of this folder were created using [`ty-ras/start` npx starter template](https://github.com/ty-ras/meta/tree/main/start).

# Next tasks

As a very first task, it is good idea to pick your favourite testing framework (Vitest is a good candidate if you will keep Vite as a bundler), and write some tests for the code.

As a good second task, one can run development server.
To do that, simply install dependencies (if not already done during project creation stage), and execute `dev` script from `package.json`:
```sh
__PACKAGE_MANAGER__ install && __PACKAGE_MANAGER__ run dev
```

After running the command above, the text ` VITE v4.2.1  ready in 1414 ms` will signal that HTTP server is now listening at given port, and the browser can be used to load the frontend.

# The code structure

The `src` folder contains all the code.
That folder is further structured in the following way:
- `services` folder contains code not related to UI directly. It currently only contains one folder `backend` with the following contents:
    - `protocol` folder contains type definitions related to exposed HTTP endpoints and the data flowing between them.
      This is the core which utilizes some TyRAS interfaces, but mostly it is just defining the endpoint shape using TypeScript types, and data contents using `io-ts` validators. 
    - `endpoints/greeting.ts` file contains code which will build invokable callback which will use the greeting API of the protocol.
    - `factory.ts` file contains common code used by all files in `endpoints` folder.
    - `index.ts` exposes an object which contains all of the callbacks to call endpoints defined in the [protocol component](../protocol).
      Currently there is only 1 (`greeting.ts`), but new ones can be added easily.
- `hooks` folder contains small API for using `Task`s of the `fp-ts` library with React hooks.
- `view` folder contains all directly UI-related code.
  This sample has only the very basic UI component, in order to avoid extra work if e.g. UI framework/bundler are changed.
- `config.ts` file contains runtime validator for the configuration of the program.
  It currently only has HTTP server host and port settings, but it can easily be expanded to encompass things like authentication-related properties, and such.
  The development configuration matching this validator is in `.env` file.
  Importing this file for a first time will use `VITE_MY_FRONTEND_CONFIG` environment variable as supplied by `.env` file, and will try to parse it as inline JSON, and run through validator.
  The resulting configuration object will be exposed as a default export.
- `main.ts` file is an entrypoint to the program.
  It is a typical React entrypoint code, rendering the DOM to HTML element identified as `root`.