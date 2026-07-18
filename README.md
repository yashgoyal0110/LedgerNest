# LedgerNest

LedgerNest is a private, self-hosted workspace for turning receipts, invoices, and financial documents into organised
transactions with Google Gemini.

## VM deployment

Requirements: Docker Engine with the Compose plugin. The application binds to VM loopback port `3003` for the
existing host-level Caddy instance.

```bash
cp .env.example .env
# Edit .env and set GEMINI_API_KEY, POSTGRES_PASSWORD, BETTER_AUTH_SECRET, and APP_URL.
docker compose up -d --build
```

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
docker compose pull
docker compose up -d --build
```

Persistent data is stored in `./data` and `./pgdata`. Back these up before upgrades.

## Configuration

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Public HTTPS URL served by the existing Caddy instance |
| `GEMINI_API_KEY` | Gemini API key used for document analysis |
| `GOOGLE_MODEL_NAME` | Gemini model; defaults to `gemini-2.5-flash` |
| `POSTGRES_PASSWORD` | Password for the internal PostgreSQL service |
| `BETTER_AUTH_SECRET` | Long random secret used for sessions and credential encryption |

This project includes software originally released under the MIT License. See [LICENSE](LICENSE) for required notices.
