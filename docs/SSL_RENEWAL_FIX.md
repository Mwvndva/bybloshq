# SSL Root Cause & Fix — `NET::ERR_CERT_DATE_INVALID`

## Summary

The production error `NET::ERR_CERT_DATE_INVALID` was **not a frontend issue**.
Nothing in `src/` can produce it. It is caused by an **expired Let's Encrypt
certificate**, and the underlying reason the cert expired is a **broken
auto-renewal design**.

## Root cause

Certificates for `bybloshq.space` are Let's Encrypt certs (90-day validity),
issued with the **certbot `standalone` authenticator** (see
`scripts/renew-ssl.sh`). The standalone authenticator must **bind port 80** to
answer the ACME HTTP-01 challenge.

In production, **nginx runs in Docker and permanently owns port 80** — it serves
the HTTP→HTTPS redirect (`nginx/production.nginx.conf`):

```nginx
server {
    listen 80;
    server_name bybloshq.space www.bybloshq.space api.bybloshq.space;
    return 301 https://$host$request_uri;
}
```

`scripts/setup-ssl-auto-renewal.sh` installs a daily cron:

```
0 3 * * * certbot renew --quiet 2>&1 | logger -t certbot
```

This cron has **no pre/post hook to free port 80**. So when certbot renew
finally tries to renew (within 30 days of expiry), the standalone authenticator
**cannot bind port 80** (nginx holds it) and the renewal **fails**. Because it
runs with `--quiet` piped to `logger`, the failure is **silent** — nobody
notices until the 90-day cert actually expires and every visitor gets
`NET::ERR_CERT_DATE_INVALID`.

The manual `scripts/renew-ssl.sh` works only because it explicitly runs
`docker compose stop nginx` first — but that emergency path is not what the
daily automation runs.

## Immediate remediation (cert already expired)

SSH into the VPS and run the existing emergency script (it stops nginx, renews
via standalone, copies certs into `./ssl/`, restarts nginx):

```bash
cd /path/to/bybloshq
sudo ./scripts/renew-ssl.sh
```

Verify:

```bash
openssl x509 -enddate -noout -in ./ssl/fullchain.pem
```

## Permanent fix — choose one

### Option A (recommended): webroot authenticator, zero downtime

Renewal no longer needs port 80 exclusively; nginx keeps serving.

1. Add an ACME challenge location to the port-80 server block in
   `nginx/production.nginx.conf`, **before** the redirect:

   ```nginx
   server {
       listen 80;
       server_name bybloshq.space www.bybloshq.space api.bybloshq.space;

       location /.well-known/acme-challenge/ {
           root /var/www/certbot;
       }

       location / {
           return 301 https://$host$request_uri;
       }
   }
   ```

2. Mount the webroot into the nginx container (`docker-compose.yml`):

   ```yaml
   nginx:
     volumes:
       - ./ssl:/etc/nginx/ssl:ro
       - ./certbot-webroot:/var/www/certbot
   ```

3. Re-issue once with the webroot authenticator:

   ```bash
   certbot certonly --webroot -w ./certbot-webroot \
     -d bybloshq.space -d www.bybloshq.space
   ```

4. The daily `certbot renew` cron now succeeds without touching port 80. The
   existing certbot **deploy hook** (installed by
   `scripts/setup-ssl-auto-renewal.sh`) copies the renewed certs into `./ssl/`
   and reloads nginx (`docker compose kill -s HUP nginx`).

### Option B (minimal change): standalone + stop/start hooks

Keep the standalone authenticator but free port 80 around the renewal. Update
the cron installed by `scripts/setup-ssl-auto-renewal.sh`:

```
0 3 * * * certbot renew --pre-hook "docker compose -f /path/to/bybloshq/docker-compose.yml stop nginx" --post-hook "docker compose -f /path/to/bybloshq/docker-compose.yml start nginx" 2>&1 | logger -t certbot
```

Downside: a brief nginx outage during each renewal.

## Also fix: make failures visible

`--quiet` hides renewal failures. Add monitoring so a future failure surfaces
before the cert expires:

- Run `certbot renew --dry-run` on a schedule and alert on non-zero exit, **or**
- Add external cert-expiry monitoring (e.g. an uptime check that alerts when the
  TLS cert is < 14 days from expiry).

Validate the renewal config at any time:

```bash
sudo certbot renew --dry-run
```
