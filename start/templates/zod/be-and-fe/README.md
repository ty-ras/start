# HTTP Backend and Frontend with TyRAS Framework

Welcome to TyRAS-oriented Node HTTP fullstack app!
This app is using [`zod`](https://github.com/colinhacks/zod) as data validation framework.
The contents of this folder were created using [`ty-ras/start` npx starter template](https://github.com/ty-ras/meta/tree/main/start).

# Project structure

This project utilizes [workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces) to organize the following components:
- [backend component](./components/backend) to hold the code for the HTTP backend,
- [frontend component](./components/frontend) to hold the code for the browser frontend, and
- [protocol component](./components/protocol) to hold the code defining the HTTP endpoints and data contents used by both backend and frontend.

# Next tasks

As a very first task, install dependencies of all the components using your favourite package manager:
```sh
yarn install
npm install
pnpm install
```

Then, feel free to explore the three components mentioned above to learn more about them.
Each of them will have a separate `README.md` file explaining their purpose and structure.
