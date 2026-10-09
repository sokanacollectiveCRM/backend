# Cloud SQL Migrations

Run migrations using credentials from `.env`:

```bash
# Run a specific migration (loads CLOUD_SQL_* from .env)
npm run migrate:cloudsql -- src/db/migrations/create_payment_schedules_cloudsql.sql

# Public intake: persist primary_language_other (nullable)
npm run migrate:cloudsql -- src/db/migrations/20261009_phi_clients_primary_language_other.sql

# Shortcut for payment schedules
npm run migrate:payment-schedules
```

Never pass credentials manually—always use the migration runner, which loads
`.env` automatically.
