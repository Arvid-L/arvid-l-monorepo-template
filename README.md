# ArvidLMonorepoTemplate

Monorepo Base Structure for my future projects. 

## Stack

- Backend: NestJS 11
- Frontend: Angular 
- Typescript

## nx projects

- apps/api
- apps/frontend
- libs/shared


## How to run

```
npm i
npm run serve:all
```

Or if you want to run them separately:

```
nx serve api
nx serve frontend
```

For quality check (tests, build, linting):

```
npm run quality

# or separately
npm run test
npm run lint
npm run build
```


