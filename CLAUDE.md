# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`nukhba_alawael` is a NestJS 11 + TypeORM (PostgreSQL) backend for an e-learning platform. Domain: schools own learning content organized as tracks → courses → units → lessons, plus books, FAQs, and info pages. Auth is JWT-based with three roles (`admin`, `contentWriter`, `student`).

## Commands

```bash
# Local dev (loads NODE_ENV=dev)
npm run start:dev          # watch mode
npm run start              # no watch
npm run start:prod         # runs compiled dist/main (NODE_ENV=prod)

npm run build              # nest build → dist/

npm run lint               # eslint --fix over src/test
npm run format             # prettier --write

# Tests (jest, ts-jest). Test files are *.spec.ts under src/
npm run test
npm run test:watch
npm run test:cov
npx jest src/path/to/file.spec.ts     # single file
npx jest -t "test name substring"      # single test by name

# Database
npm run seed               # runs src/database/seeders/seed.ts (faker-based)
npm run mig:gen            # generate migration from entity diff → src/database/migrations/mig
npm run mig:create         # create empty migration
npm run mig:run            # apply migrations against src/database/ds.ts

# Docker (app + postgres:16 + redis:7)
docker compose up -d --build
```

`deploy.sh` runs on the server: `git pull origin main` then rebuilds via docker compose.

## The `@salem/core` local package (critical)

`core/` is a **separate TypeScript package** (`@salem/core`, imported everywhere as `from 'core'`). It is a `file:` dependency, and `tsconfig.json` maps the `core` import to `./core/dist/index` — i.e. **the compiled output, not the source**.

**Consequence:** editing files under `core/src/` has no effect until you rebuild the package:

```bash
cd core && npm run build     # tsc → core/dist
```

`core` provides the cross-cutting infrastructure: the CASL permission engine, the error/response envelope system, PostgreSQL query-filter helpers, the `transaction()` wrapper, base pagination DTO/model, and the Express `Request` type augmentation. When something is imported `from 'core'`, look under `core/src/`.

## Request/response conventions

- **Global prefix** is `/api` (set in `src/main.ts`). Health check: `GET /api/ping`. Registered error catalog: `GET /api/errors`.
- **Success responses** are wrapped by `BaseResponseInterceptor` (from core) into `{ message, data }`. Return raw payloads from controllers/services — do not build the envelope yourself.
- **Errors** flow through `GlobalExceptionFilter` (`src/common/filter/error.filter.ts`). Throw `AppHttpError` (from core) with a `{ code, message, statusCode, args }` shape for domain errors; standard Nest `HttpException`s are also mapped to common codes.
- **Error catalog registration**: each domain declares its codes in an `errors.ts` (e.g. `src/learning/errors.ts`) that calls `ErrorsRecord.addErrors(...)` at import time. These modules are pulled in via side-effect `require('./errors')` at the top of the module file (see `src/learning/learning.module.ts`). `core`'s common errors are registered in `initialize()`, awaited before the app boots.
- Query strings are parsed with `qs` (nested/array query params supported).

## Authorization: three layered mechanisms

1. **`JwtGuardStrict`** (`src/core/auth`) — validates the bearer token; the JWT strategy sets `req.userContext.user` and `req.user`.
2. **`RoleGuard([RoleType.x])`** (`src/core/guards/role.guard.ts`) — coarse role gate, the most common guard on controllers. Roles live in `src/core/role/enum/role.type.ts`.
3. **CASL fine-grained permissions** (`core/src/casl/`) — `CASLGuard(subject, action, resolveActor?)` builds per-request abilities from policies registered via `CASLPermissionsRegister.register(subject, accessConfig)`. Policies also support field-level restrictions (`forbiddenBodyFields`/`forbiddenQueryFields`), actor/entity conditions, and DB-query scoping. Results land on `req.permissions`. Note: the CASL layer is scaffolded but largely unused today (see the commented-out `src/common/policy/management.policy.ts`) — most endpoints rely on `RoleGuard`.

### Request context

`Context` (`src/context`, request-scoped, injected as `ctxt`) is the accessor for per-request state: `ctxt.user`, `ctxt.school`, `ctxt.permissions` (each throws if absent) plus `*OrNull` variants. Prefer it over reading `req` directly. The custom fields on Express `Request` (`userContext`, `school`, `permissions`) are declared in `src/types/express-types.d.ts` and `core/src/types/express`.

## Module & code layout

- `src/core/` — auth, users, roles. `CoreService` is the cross-module facade for user creation/lookup (other domains call it rather than `UserService` directly).
- `src/school/` — schools, owned by a `contentWriter` user. `SchoolOwnerGuard` + the `school/me` vs `school/manage` controller split (owner-scoped vs admin) is the pattern to mirror for new owner-scoped resources.
- `src/learning/` — the content tree: `tracks/`, `course/`, `units/`, `lessons/`, `books/`, `questions/`, plus `school-access/` (which tracks a school may use). Aggregated by `learning-management.controller.ts` (admin) and `learning-school.controller.ts` (owner).
- `src/public-content/` — `faqs/`, `info/` (public-facing content).
- `src/file/` — upload/storage abstraction. `FileProvider` is pluggable (`file.disk.provider.ts` writes to `FILE_STORE`). Files have a `used`/`unUsed` lifecycle; `FileService` reference-counts them.
- `src/otp/`, `src/redis.module.ts` — OTP flow backed by Redis (ioredis).

### File upload lifecycle (important when touching uploads)

Uploaded files start as `unUsed`; call `files.use(...)` when a file becomes referenced and `files.replace(...)`/`softRemove(...)` when swapping. Cleanup happens two ways: explicit `cleanUp(ids)` on transaction rollback, and a **Postgres `LISTEN/NOTIFY`** channel — `FilePgListener` (`src/file/file.pg.listener.ts`) listens on `app_file_soft_delete`, fired by the trigger in migration `1782127318747-AppFileSoftRemoveTrigger.ts`. When mutating file-owning entities, wrap the work in `transaction(ds, fn, { onError })` and clean up stored blobs in `onError`.

## Database notes

- Single `AppDataSource` in `src/database/ds.ts`, configured from `DBLINK`. **`synchronize: true`** is on — schema auto-syncs from entities in dev. Migrations exist but are not auto-run (`migrationsRun: false`); use them for triggers/data that synchronize can't express.
- Entities are discovered by glob (`**/*.entity.{ts,js}`); name new entity files `*.entity.ts`.
- Use `applyPsqlFilter({ queryBuilder, query, options })` (from core) for list/filter endpoints and return a `BasePaginationModel`. See `SchoolService.getByCriteria` for the canonical pattern.
- Multi-step writes use the `transaction(dataSource, async em => {...}, { onError })` helper from core, passing the `EntityManager` through to services.

## Conventions

- Validation: `ValidationPipe` with `{ transform: true, whitelist: true, forbidNonWhitelisted: true }` is applied per-controller (not globally). DTOs use `class-validator`/`class-transformer`.
- `noImplicitAny` is off and `@typescript-eslint/no-explicit-any` is disabled — `any` is used liberally in the CASL/actor plumbing by design.
- Env vars: `PORT`, `DBLINK`, `JWT_TOKEN_KEY`, `REFRESH_TOKEN_KEY`, `FILE_STORE`, `REDIS_URL`, `REDIS_PORT` (see `env-example`). Token/OTP timings are in `src/conf.ts` (`AppConfig`).
