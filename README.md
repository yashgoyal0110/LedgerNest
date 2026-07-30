# LedgerNest

LedgerNest turns receipts, invoices, and financial documents into organised transactions with Google Gemini.

It is **multi-tenant**: every business gets a *workspace* (tenant), and all data — transactions, files, categories,
projects, fields, settings, app data — belongs to that workspace, not to an individual user. Several people can share a
workspace and see the same books. Plan, storage and AI quota are billed and enforced per workspace.

Every new workspace starts with **5 free AI analyses**.

## Deployment

Requirements: Docker Engine with the Compose plugin. The application binds to VM loopback port `3003` for the
existing host-level Caddy instance.

```bash
cp .env.example .env
# Required: APP_URL, POSTGRES_PASSWORD, BETTER_AUTH_SECRET (32+ chars), GEMINI_API_KEY
# For the public demo: DEMO_MODE=true and a DEMO_PASSWORD (8+ chars)
docker compose up -d --build
```

Database migrations run automatically on container start (`prisma migrate deploy`).

Append this block to the VM's existing Caddyfile:

```caddyfile
ledgernest.8.229.88.229.sslip.io {
    encode zstd gzip

    header {
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    reverse_proxy 127.0.0.1:3003
}
```

Then validate and reload the existing Caddy service:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Open `https://ledgernest.8.229.88.229.sslip.io`. The application port is bound only to `127.0.0.1`, and PostgreSQL is
private to the Compose network.

Useful commands:

```bash
docker compose ps
docker compose logs -f app
docker compose up -d --build
```

Persistent data is stored in `./data` (uploads) and `./pgdata` (database). Back these up before upgrades.

## Modes

| Mode | `SELF_HOSTED_MODE` | Behaviour |
| --- | --- | --- |
| Cloud / multi-tenant (default) | `false` | Sign-in required; one workspace per business; per-workspace AI quota; demo workspace available |
| Single-user self-hosted | `true` | No sign-in, one implicit workspace with unlimited quota; the demo is disabled |

## Demo workspace

With `DEMO_MODE=true` (cloud mode only), the login page offers a one-click way in:

- **Enter demo workspace** — provisions, seeds, and signs in immediately.
- **Fill demo credentials** — fills the email and password into the form so the visitor can see them before signing in.

The demo workspace is created on first use and seeded with a full year of realistic books: ~120 transactions across
12 months in EUR and USD, income and expenses, four projects, custom fields, a saved invoice template, and six receipt
images waiting in the Unsorted inbox — so every screen has something to show.

It gets the same **5 AI analyses**, but they **refill automatically every hour**. The refill happens lazily whenever a
page is loaded, and the cron container also calls `GET /api/cron/refill-ai-credits` hourly as a backstop (protect that
endpoint by setting `CRON_SECRET`).

## Configuration

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Public HTTPS URL served by the existing Caddy instance |
| `SELF_HOSTED_MODE` | `false` (default) for multi-tenant cloud mode, `true` for single-user mode |
| `GEMINI_API_KEY` | Gemini API key used for document analysis |
| `GOOGLE_MODEL_NAME` | Gemini model; defaults to `gemini-2.5-flash` |
| `POSTGRES_PASSWORD` | Password for the internal PostgreSQL service |
| `BETTER_AUTH_SECRET` | Long random secret used for sessions and credential encryption |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Sends the one-time login codes; not needed for demo sign-in |
| `DISABLE_SIGNUP` | Blocks new self-service accounts |
| `DEMO_MODE` | Enables the shared demo workspace (default `true` in cloud mode) |
| `DEMO_EMAIL` / `DEMO_PASSWORD` | Credentials for the demo account |
| `CRON_SECRET` | Bearer token required by `/api/cron/refill-ai-credits` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Optional; subscriptions are applied to the workspace |

This project includes software originally released under the MIT License. See [LICENSE](LICENSE) for required notices.
