# Supabase Setup

Contexta uses Supabase for Auth, PostgreSQL metadata, and Storage.

## Apply Migration

Open the Supabase SQL editor for the project and run:

```sql
-- contents of infra/supabase/migrations/0001_initial_schema.sql
```

The migration creates:

- User-owned metadata tables.
- Row-level security policies.
- The private `contexta-documents` storage bucket.
- Storage object policies scoped by the first folder segment, which must be the authenticated user id.

## Required Environment

Set these values in local `.env` files:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_STORAGE_BUCKET=contexta-documents
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
