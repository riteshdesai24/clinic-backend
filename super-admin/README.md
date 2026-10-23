# Super admin API

The super admin API is mounted at `/api/super-admin`.

The first super admin can register without a key. After that, registration is closed unless a strong `SUPER_ADMIN_REGISTRATION_KEY` is configured; additional registrations then require that value in the `x-registration-key` header. Super admin login returns a bearer token; send it as `Authorization: Bearer <token>` to all management endpoints.

## Authentication

- `POST /api/superadmin/auth/register` or `POST /api/super-admin/register` — body: `{ "name", "email", "password" }`
- `POST /api/superadmin/auth/login` or `POST /api/super-admin/login` — body: `{ "email", "password" }`

Passwords must be at least 8 characters and include uppercase, lowercase, number, and special character.

## Clinics

- `GET /api/super-admin/clinics`
- `POST /api/super-admin/clinics` — `{ "clinicName", "email", "password", "phone?", "plan?" }`
- `PUT /api/super-admin/clinics/:id` — update `clinicName`, `email`, `phone`, `plan`, or `isActive`
- `DELETE /api/super-admin/clinics/:id` — deactivates the clinic so its records remain intact

Clinics use the existing `ADMIN` user records. Their plan values are strings so custom memberships can be assigned.

## Country, state, and city masters

Use `countries`, `states`, or `cities` in the following routes:

- `GET /api/super-admin/:type`
- `POST /api/super-admin/:type`
- `PUT /api/super-admin/:type/:id`
- `DELETE /api/super-admin/:type/:id`

Country fields: `name`, optional `code`. State fields: `name`, `country` (country ID). City fields: `name`, `state` (state ID). A country cannot be deleted while it has states, and a state cannot be deleted while it has cities.

## Memberships

- `GET /api/super-admin/memberships`
- `POST /api/super-admin/memberships` — `{ "name", "price", "durationMonths?", "staffAllowed?", "description?", "features?: string[]" }`
- `PUT /api/super-admin/memberships/:id`
- `DELETE /api/super-admin/memberships/:id`

The existing `Plan` collection is used for memberships. `features` is an array of strings, such as `Appointment scheduling` and `Invoice management`, and `description` is a summary shown with the plan. Membership list/detail/create/update responses and `GET /api/plans` include both fields. `GET /api/plans` remains available to the clinic app; write operations on `/api/plans` also require a super admin token. In the Excel template, separate multiple features in one cell with `|` or `;`.

## Treatment and lab masters

- `/api/super-admin/treatments` — GET, POST, PUT `/:id`, DELETE `/:id`. Fields: `name`, `description?`, `duration?` (minutes), `price?`, `status?` (`ACTIVE` or `INACTIVE`). Super-admin treatments are global and appear in each clinic's existing treatment master list; clinics cannot edit or delete the global records.
- `/api/super-admin/labs` — GET, POST, PUT `/:id`, DELETE `/:id`. Fields: `name`, `code?`, `description?`, `email?`, `phone?`, `address?`, `isActive?`.

## Excel bulk import

Download a workbook template with `GET /api/super-admin/imports/excel/:resource/template`. Upload the completed workbook as `multipart/form-data`, field name `file`, to `POST /api/super-admin/imports/excel/:resource`. Supported resource names are `clinics`, `countries`, `states`, `cities`, `memberships`, `treatments`, and `labs`. Imports create new rows or update existing rows by their natural key. The response reports created, updated, and failed rows; invalid rows are skipped and include their spreadsheet row number. Upload limit is 10 MB and 5000 data rows.

Location rows are linked by names: a state row needs its `country` name, and a city row needs both `state` and `country` names. Import countries before states, then states before cities. Clinic rows need `clinicName`, `email`, and a strong `password` for new accounts; existing accounts can be updated by email without changing their password. Store clinic workbooks securely because they may contain passwords.
