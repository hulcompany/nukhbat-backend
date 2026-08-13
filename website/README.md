# website/ — the three test portals

Three plain HTML/JS portals served by the API itself, one per role. No build
step, no dependencies: `main.ts` serves this folder statically at `/`.

| URL         | Role            | Session key    |
| ----------- | --------------- | -------------- |
| `/`         | landing page    | —              |
| `/admin/`   | `admin`         | `nkb-admin`    |
| `/school/`  | `contentWriter` | `nkb-school`   |
| `/student/` | `student`       | `nkb-student`  |

Each portal stores its own token, so you can be logged in as all three at once
in three tabs.

```
website/
  index.html          landing + /api/ping health check
  shared/
    styles.css        design system (RTL, per-portal accent colour)
    core.js           API client, session, UI kit (form/table/modal/pager),
                      portal shell + login, shared account/notifications screens
    questions.js      all six question types: solve UI, verdict review,
                      authoring builder, answer-key preview
  admin/  school/  student/     index.html + app.js per portal
```

## What each portal covers

**admin** — dashboard aggregates · users (list/filter/edit/image) · schools
(create owner+school, edit, logo, grant/revoke track access) · curriculum
read views (courses/units/lessons/questions across schools) · subscription keys
(generate/list/delete/bulk-delete) and subscriptions · students · daily
wisements (single/bulk/edit/delete) · FAQs · app info · notifications (incl.
send) · own account.

**school** — school profile + statistics + logo · weekly activity and monthly
subscription aggregates · curriculum tree, units and lessons (create, rename,
reorder, publish/draft, delete) · questions (all six types, bulk JSON create,
edit title/tips/image, delete, bulk delete, preview with answer key) · daily
challenge (pool report + generate) · books · students (list, detail,
activate/deactivate) · subscription keys · attempts (with per-question review)
· leaderboard per track · notifications · own account.

**student** — signup/login/forgot-password · free trial or key subscription ·
curriculum with progress · solving lessons and the daily challenge (all six
question types) with a result + review screen · attempts history · saved
questions · books · leaderboard · profile + statistics · public content ·
notifications · own account.

## Known limits

- **The question builder sends JSON.** `POST /curriculum/school/questions` also
  accepts multipart (multer parses `a[0][b]` bracket notation via
  `append-field`), which is the only way to attach `image` on create — see the
  form-data requests in the Postman collection. `fillBlanks` is the exception:
  `fillBlanks[].index` has no `@Transform`, so multipart delivers it as a
  string and `@IsInt()` rejects it. In the portal, images are attached through
  `PATCH .../questions/:id`, which the edit dialog supports.
- OTP screens (request-verify / verify / forgot-password) need Redis running.
- A student sees content only after a subscription; every subscription-guarded
  screen surfaces the API error and links to the subscription tab.
