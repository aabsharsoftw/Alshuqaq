# Rental App Backend

Backend for a rental apartment listing marketplace built on a **middleman model**:
tenants and landlords never interact directly — all enquiries flow to the Admin.

Built with **NestJS · PostgreSQL · Prisma · Resend · ImageKit · Swagger**.

## Roles & rules

- **Tenant** — signs up/logs in, browses approved listings, submits enquiries.
- **Landlord** — signs up/logs in, uploads listings (images) for admin approval.
- **Admin** — approves/rejects listings, approves (trusts) landlords, views enquiries.

Key behaviours:
- Email/password auth only (JWT). No OTP.
- **Trusted landlords**: once an admin approves a landlord, their *future* listings are auto-approved.
- Each listing has a sequential public `listingNumber` starting at **1** (e.g. `#354`).
- Listing fields (including **location**) are editable by the owner or an admin.
- Images only (multiple per listing), uploaded server-side to ImageKit.
- Resend emails: tenant welcome, enquiry confirmation, admin new-enquiry, admin new-listing, landlord decision.

## Quick start (local)

```bash
cp .env.example .env          # then fill in real Resend/ImageKit keys
docker compose up -d db       # start Postgres
npm install
npx prisma migrate dev        # apply migrations
npm run prisma:seed           # create the admin user from .env
npm run start:dev
```

- API: `http://localhost:3000`
- Swagger docs: `http://localhost:3000/docs`
- Health: `http://localhost:3000/health`

## Run everything in Docker (VPS)

```bash
cp .env.example .env          # fill in secrets; DB host is handled automatically
RUN_SEED=true docker compose up --build -d
```

The app container runs `prisma migrate deploy` on start, optionally seeds the admin
(when `RUN_SEED=true`), then launches the API.

## Environment variables

See `.env.example` for the full list (app, database, JWT, admin seed, Resend, ImageKit).

## API overview

| Area      | Endpoint                                  | Access            |
|-----------|-------------------------------------------|-------------------|
| Auth      | `POST /auth/signup`, `POST /auth/login`   | Public            |
| Auth      | `GET /auth/me`                            | Authenticated     |
| Listings  | `GET /listings`, `GET /listings/:idOrNumber` | Public         |
| Listings  | `POST /listings` (multipart)              | Landlord          |
| Listings  | `GET /listings/mine`                      | Landlord          |
| Listings  | `PATCH /listings/:id`, `DELETE /listings/:id` | Owner / Admin |
| Enquiries | `POST /listings/:id/enquiries`            | Public            |
| Enquiries | `GET /enquiries`                          | Admin             |
| Admin     | `GET /admin/listings?status=`             | Admin             |
| Admin     | `PATCH /admin/listings/:id/approve|reject`| Admin             |
| Admin     | `GET /admin/landlords`                    | Admin             |
| Admin     | `PATCH /admin/landlords/:id/approve`      | Admin             |
| Admin     | `GET /admin/enquiries`                    | Admin             |

Authentication uses a Bearer JWT. Logout is handled client-side by discarding the token.
