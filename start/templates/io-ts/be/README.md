# HTTP Backend with TyRAS Framework

Welcome to TyRAS-oriented Node HTTP server app!
This app is using [`io-ts`](https://github.com/gcanti/io-ts) as data validation framework.
The contents of this folder are created using [`ty-ras/start` npx starter template](https://github.com/ty-ras/meta/tree/main/start).

# Next tasks

As a very first task, it is good idea to pick your favourite testing framework, and write some tests for the code.
To run development server, simply execute `dev` script from `package.json` using your favourite package manager:
```sh
yarn run dev
npm run dev
pnpm run dev
...
```

# The code structure

The `src` folder contains all the code.
That folder is further structured in the following way
- `api` folder contains all code related to HTTP server:
    - `protocol` subfolder contains type definitions related to exposed HTTP endpoints and the data flowing between them.
      This is the core which utilizes some TyRAS interfaces, but mostly it is just defining the endpoint shape using TypeScript types, and data contents using `io-ts` validators.
    - `auxiliary` subfolder contains the utility code, used when constructing HTTP server containing endpoints defined by `protocol` folder.
      The only file most likely needing to be customized as application evolves, is `state.ts`.
    - `endpoints` subfolder contains the code which constructs the endpoints defined by `protocol` folder, using functions and constants provided by TyRAS framework, and code in `auxiliary` folder.
      