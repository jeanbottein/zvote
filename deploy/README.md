# Putting super-vote on the internet

What is exposed, and what protects it. The images, the Compose file and CI
come with phase 6 ([docs/ROADMAP.md](../docs/ROADMAP.md)); they are built
around what is here.

## One address, HTTPS only

```
 internet
    │ 443: HTTPS and HTTP/3     80: redirects to HTTPS, certificate challenges
 ┌──┴─────────────────────────────────┐
 │ Caddy (deploy/Caddyfile)           │  certificates, security headers, the web app's files
 └──┬─────────────────────────────────┘
    │ /api/*, /v3/api-docs*, /llms.txt, on a private network
 ┌──┴─────────────────────────────────┐
 │ Java server, :8080                 │  never published
 └──┬─────────────────────────────────┘
    │
 ┌──┴─────────────────────────────────┐
 │ PostgreSQL, :5432                  │  never published
 └────────────────────────────────────┘
```

`https://super-vote.org` is the web app, `/api` its API, `/api/mcp` the MCP
tools, `/v3/api-docs` the OpenAPI document and `/llms.txt` the guide for
agents: people and agents use the same address, and nothing else has a port.
Caddy gets and renews the certificate itself (Let's Encrypt), answers HTTP
with a redirect, and sends HSTS so that browsers never try HTTP again;
`www.super-vote.org` redirects to the bare domain. Publishing the server's
port would let clients past everything Caddy does.

Caddy reads three settings from its environment:

| Variable | Default | What |
|---|---|---|
| `SUPER_VOTE_DOMAIN` | `super-vote.org` | the site's address |
| `SUPER_VOTE_SERVER` | `server:8080` | where the Java server listens |
| `SUPER_VOTE_WEB` | `/srv/web` | the built web app (`npm run build` in `clients/web`, then its `dist`) |

The server needs `SUPER_VOTE_VOTER_SECRET`, `SUPER_VOTE_PUBLIC_URL=https://super-vote.org`
and its database (`SPRING_DATASOURCE_*`): see the
[server's README](../servers/java/README.md). It reads the client's address
and scheme from Caddy's `X-Forwarded-For` and `X-Forwarded-Proto`, believed
from a private address only.

## What protects what

| Layer | Against |
|---|---|
| OVHcloud's network (anti-DDoS, included) | floods, before they reach the VPS |
| The VPS's firewall | everything but SSH, 80 and 443 |
| Caddy | plain HTTP (HSTS), slow clients (timeouts), bodies over 64 KB, injected scripts and framing (Content Security Policy), a poll's address passed on to other sites (`Referrer-Policy: no-referrer`), unlisted polls in search engines (`X-Robots-Tag: noindex` on `/p/*`) |
| The server | a network creating more than 20 polls a day, or guessing join codes ([docs/API.md](../docs/API.md#fair-use)); and identity, invitations and ballots ([docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md#identity)) |

Nothing that grants anything can be guessed: a poll's link holds 128 random
bits, a voter's token 256, an invitation or a handover a 128-bit signature. A
ballot can only be changed by whoever cast it. What anyone holding a link can
do is vote, from as many browsers as they like, on a poll that takes no
invitations: counting each person once is what invitations are for.

## The VPS

- **SSH**: keys only (`PasswordAuthentication no`), no root login
  (`PermitRootLogin no`), and fail2ban's `sshd` jail, which bans an address
  after failed logins.
- **Firewall**: allow 22/tcp, 80/tcp, 443/tcp and 443/udp (HTTP/3), deny the
  rest (`ufw default deny incoming`). Docker publishes ports past ufw's
  rules: publish Caddy's, never the server's or PostgreSQL's.
- **Updates**: `unattended-upgrades` for security fixes.
- **Secrets**: the voter secret and the database password in an environment
  file only root reads (`chmod 600`), never in an image, the repository or a
  backup.
- **Logs**: Caddy keeps no access log unless told to, and the server logs no
  request; keep it so, or keep them short: they hold addresses.
- **Backups**: a nightly `pg_dump`, logical (see ARCHITECTURE.md, "Known
  limit: what the database itself records").

If abuse comes anyway: one address hammering the site is for CrowdSec or
fail2ban reading Caddy's access log, or the `caddy-ratelimit` plugin (a
custom build); many addresses, for OVHcloud's mitigation, or Cloudflare in
front, which Caddy must then trust for the client's address
(`trusted_proxies`).

## Trying the Caddyfile

`caddy validate --config deploy/Caddyfile` checks it. To run it locally over
plain HTTP, in front of `./dev.sh server` and a built web app:

```bash
sed -e 's|^{$SUPER_VOTE_DOMAIN:super-vote.org} {|http://localhost:8443 {|' -e '/^www\./,/^}/d' \
  deploy/Caddyfile > /tmp/Caddyfile.local
SUPER_VOTE_SERVER=localhost:8080 SUPER_VOTE_WEB=clients/web/dist caddy run --config /tmp/Caddyfile.local
```

Its Content Security Policy lets `index.html`'s inline script run by its
hash: change the script and `npm test` names the hash to put in its place.
