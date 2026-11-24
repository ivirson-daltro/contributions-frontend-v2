# @ibg/app

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Authentication

The login uses Supabase Auth directly, as specified for F02. Configure the
project URL and its public publishable key in
[`src/environments/environment.ts`](src/environments/environment.ts). These
values are exposed to the browser and must not be used for privileged
operations; never put a `service_role` key in the frontend.

On the login screen, users can opt to remember their email in the current
browser. It is saved after successful authentication and removed when the
option is unchecked; the option does not store passwords.

Password recovery uses Supabase Auth and redirects to `/reset-password` on the
current origin. Add the exact recovery URL for each deployed origin (and local
development, if used) to the Supabase Auth redirect allow list. The default
Supabase recovery email template must redirect back to the application.
Recovery links use Supabase's default implicit flow. After a successful callback,
the URL is cleared; refreshing the reset page requires requesting a new link.
Supabase Auth limits recovery email requests; configure a custom SMTP provider
and appropriate Auth rate limits for production. See
[Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits) and
[custom SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

Development builds use `http://localhost:3000/v1` from
`src/environments/environment.ts`. Production builds replace that file with
`src/environments/environment.production.ts` and use `/v1` on the same origin.
Update the production file when the API is served from another host.

The local API at `http://localhost:3000` does not expose a login endpoint.
The platform console at `/platform` uses the API URL configured as `apiUrl` in
[`src/environments/environment.ts`](src/environments/environment.ts). It
requires an active global administrator and verifies TOTP MFA before listing
or creating churches. The first TENANT_ADMIN invitation is shown only in the
creation response; copy it before dismissing the confirmation.

The `/accept-invite?token=...` route loads the public invitation preview and
supports both account creation for a new invitee and authenticated acceptance
for an existing account. The invitation token is not persisted in browser
storage; it remains in the link and is sent only to the invitation API.

## Application structure

Shared authentication infrastructure lives in `src/app/core/auth`, while the
authentication layout lives in `src/app/layout`. Feature code is organized by
domain under `src/app/modules`: `auth`, `memberships`, `dashboard`, `platform`,
`contributions`, and `members`. Each feature keeps components, services, and DTOs in separate
directories; tests stay alongside the files they cover.

The tenant contribution page lists and filters records, creates and edits contributions,
and confirms logical deletion (annulment) with an optional reason. Edits and deletions
use optimistic concurrency; when a record is stale, closing the dialog refreshes the list.
The list displays each contribution's observation instead of an attachments column.
The list shows the displayed item range and supports 10, 20, 50 or 100 items per page;
changing the page size returns to the first page without clearing filters.
The list and contribution create/edit dialog are separate components; successful saves
and stale-dialog closures notify the list to refresh.
The member selectors in the contribution filters and form share the active members loaded
from `/members/all` and filter names locally.
It also downloads a PDF report for a selected period of up to 366 inclusive days.
The report includes all active contributions in that period, regardless of the
other list filters. Attachment uploads remain unavailable.

The members page at `/tenant/:slug/members` uses the tenant member and member-type
catalog APIs for filtering, pagination, details, creation, partial updates, and
logical deletion. Treasurer users can create members with only name and type and
can edit or delete only records they created; secretaries and tenant admins can
manage all member fields. The API remains responsible for enforcing permissions.
Possible duplicates require explicit confirmation before retrying creation.
CSV import and a contributors tab are not available in the current API.

The tenant layout validates access and hosts lazy-loaded child routes for the
overview (`/tenant/:slug`) and contributions (`/tenant/:slug/contributions`).
The overview's new-contribution shortcut adds `?new=1` to open the form after
the contribution catalogs load.
The financial chart defaults to monthly income and expenses for the current year;
the income and expense views compare each month with the previous year.
Income is shown in green and expenses in red; the second series is hatched.

The light/dark theme selected in the tenant layout is also used by the login,
two-factor, invitation, and church-selection screens. The preference is saved
locally and defaults to light when no preference has been saved.

The shared currency input formats typed digits as Brazilian currency and uses
an ungrouped decimal string (for example, `200.55`) as its form value.
