# LedgerNest

LedgerNest is a private, self-hosted workspace for turning receipts, invoices, and financial documents into organised
transactions with Google Gemini.

## VM deployment

Requirements: Docker Engine with the Compose plugin and an available TCP port `3003`.

```bash
cp .env.example .env
# Edit .env and set GEMINI_API_KEY, POSTGRES_PASSWORD, BETTER_AUTH_SECRET, and APP_URL.
docker compose up -d --build
```

Open `http://YOUR_VM_IP:3003`. Caddy is the only service published on the host. The Next.js application and PostgreSQL
database are private to the Compose network.

Useful commands:

```bash
docker compose ps
docker compose logs -f caddy app
docker compose pull
docker compose up -d --build
```

Persistent data is stored in `./data`, `./pgdata`, and the named Caddy volumes. Back these up before upgrades.

## Configuration

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Public URL, including `:3003` |
| `GEMINI_API_KEY` | Gemini API key used for document analysis |
| `GOOGLE_MODEL_NAME` | Gemini model; defaults to `gemini-2.5-flash` |
| `POSTGRES_PASSWORD` | Password for the internal PostgreSQL service |
| `BETTER_AUTH_SECRET` | Long random secret used for sessions and credential encryption |

This project includes software originally released under the MIT License. See [LICENSE](LICENSE) for required notices.
