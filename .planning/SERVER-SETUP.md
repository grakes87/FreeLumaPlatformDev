# FreeLuma Production Server Setup

## Servers (Hetzner Cloud — Ashburn, VA)

| | App Server | DB Server |
|---|---|---|
| **Name** | freeluma-app | freeluma-db |
| **Plan** | CPX31 (4 vCPU, 8 GB RAM, 160 GB NVMe) | CPX21 (3 vCPU, 4 GB RAM, 80 GB NVMe) |
| **OS** | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| **Public IP** | 178.156.239.61 | 178.156.243.11 |
| **Private IP** | 10.0.0.2 | 10.0.0.3 |
| **Private Network** | freeluma-internal (10.0.0.0/16, us-east) | freeluma-internal |
| **Backups** | Enabled | Enabled |
| **Cost** | $22.19/mo | ~$12.59/mo |

**Total monthly cost:** ~$34.78/mo

## SSH Access

```bash
# App server (direct)
ssh root@178.156.239.61

# DB server (direct — may timeout due to firewall)
ssh root@178.156.243.11

# DB server (via app server jump host — more reliable)
ssh -J root@178.156.239.61 root@10.0.0.3
```

SSH key: `~/.ssh/id_ed25519` (created on Mac, added to Hetzner as "Mac")

**SSH keepalive** configured in `~/.ssh/config`:
```
Host *
  ServerAliveInterval 30
  ServerAliveCountMax 5
```

## App Server Stack

- **Node.js**: v20.20.0 (via NodeSource)
- **npm**: 10.8.2
- **PM2**: 6.0.14 (process manager)
- **Nginx**: 1.24.0 (reverse proxy + SSL termination)
- **Certbot**: 2.9.0 (installed but using Cloudflare Origin Certs instead)
- **App code**: `/var/www/freeluma/` (cloned from GitHub)
- **Env file**: `/var/www/freeluma/.env.local`
- **GitHub repo**: `grakes87/FreeLumaPlatformDev` (main branch)

## DB Server Stack

- **MySQL**: 8.0.45
- **Listening on**: 127.0.0.1:3306 + 10.0.0.3:3306
- **Config override**: `/etc/mysql/mysql.conf.d/mysqld.cnf` (bind-address edited in-place)
- **Custom config**: `/etc/mysql/mysql.conf.d/freeluma.cnf` (max_connections=200, innodb_buffer_pool_size=1G)

## Database Connection (from app server)

```
DB_HOST=10.0.0.3
DB_PORT=3306
DB_NAME=freeluma_prod
DB_USER=freeluma_app
DB_PASSWORD=FL!pr0d#X8kM2vR7nQ4wJ9sT3yB6cH1
```

## DB Server Firewall (UFW)

```
3306    ALLOW   10.0.0.2        (app server only)
22/tcp  ALLOW   Anywhere        (SSH)
22      ALLOW   67.5.119.133    (home IP)
```

## Network Architecture

```
Users → Cloudflare (SSL + CDN + DDoS) → freeluma-app (178.156.239.61)
                                              ↓ private network
                                         freeluma-db (10.0.0.3:3306)
```

- DB server MySQL bound to 127.0.0.1 + 10.0.0.3 (edited in mysqld.cnf)
- DB server port 3306 firewalled — only 10.0.0.2 (app server) allowed
- App server connects to DB via private network (sub-ms latency)
- Media served from Backblaze B2 (neither server handles files)

## Production Environment (.env.local on app server)

Key differences from dev:
- `DB_HOST=10.0.0.3` (private network to DB server, not localhost)
- `DB_NAME=freeluma_prod` (not freeluma_dev)
- `DB_USER=freeluma_app` (not root)
- `JWT_SECRET=TZpcTpj7x0QQHkthmvvbbqPxHiFwlVoPbt0eBmq9Q8ZQWiPV10vOVmBHDhQlGE2B`
- `NEXT_PUBLIC_APP_URL=https://freeluma.app`
- `EMAIL_DEV_WHITELIST=GARYWORK05@gmail.com,GARY.RAKES@FREELUMA.COM` (safety guard)

Email whitelist works in ALL environments (code updated to remove dev-only check).

## Domain & SSL (pending)

- **Domain**: freeluma.app (on Cloudflare)
- **SSL**: Cloudflare Origin Certificate (15-year, RSA 2048)
- **SSL Mode**: Full (Strict)
- **DNS**: A record → 178.156.239.61 (proxied through Cloudflare)

## Deployment Workflow

```bash
# On app server:
cd /var/www/freeluma
git pull origin main
npm install
npm run build
pm2 restart freeluma
```

## Key Files on Servers

| File | Server | Purpose |
|---|---|---|
| `/var/www/freeluma/` | App | Application root |
| `/var/www/freeluma/.env.local` | App | Environment variables |
| `/var/www/freeluma/ecosystem.config.cjs` | App | PM2 process config (TBD) |
| `/etc/nginx/sites-available/freeluma` | App | Nginx reverse proxy (TBD) |
| `/etc/mysql/mysql.conf.d/mysqld.cnf` | DB | MySQL main config (bind-address edited) |
| `/etc/mysql/mysql.conf.d/freeluma.cnf` | DB | MySQL custom config (connections, buffer) |

## Troubleshooting

- **SSH disconnects**: Fixed with `~/.ssh/config` ServerAliveInterval 30
- **DB server SSH unreliable**: Use jump host: `ssh -J root@178.156.239.61 root@10.0.0.3`
- **MySQL not listening on private IP**: Check `/etc/mysql/mysql.conf.d/mysqld.cnf` has `bind-address = 127.0.0.1,10.0.0.3`
- **Heredoc paste issues**: Terminal adds spaces to multi-line pastes — use `nano` or single-line commands instead
- **Password with ! or #**: Use single quotes in bash, not double quotes (bash expands `!` in double quotes)

## Setup Progress

- [x] Hetzner account created
- [x] SSH key generated and added
- [x] SSH keepalive configured on Mac
- [x] Private network created (freeluma-internal, us-east)
- [x] freeluma-app server created (CPX31, Ashburn)
- [x] freeluma-db server created (CPX21, Ashburn)
- [x] App server: Node.js, npm, PM2, Nginx, Certbot installed
- [x] App server: kernel rebooted
- [x] DB server: MySQL 8.0.45 installed
- [x] DB server: kernel rebooted
- [x] DB server: MySQL bind-address = 127.0.0.1,10.0.0.3 (in mysqld.cnf)
- [x] DB server: freeluma.cnf (max_connections=200, innodb_buffer_pool_size=1G)
- [x] DB server: freeluma_prod database created (utf8mb4_unicode_ci)
- [x] DB server: freeluma_app user created (bound to 10.0.0.2)
- [x] DB server: UFW firewall — 3306 from 10.0.0.2 only, SSH from home IP
- [x] App→DB connection verified (SHOW DATABASES works)
- [x] App code cloned to /var/www/freeluma/
- [x] Production .env.local created on app server
- [x] Email whitelist guard updated (works in all environments)
- [x] npm install on app server
- [x] npm run build on app server
- [x] Run database migrations (sequelize db:migrate)
- [x] Dev database dumped and imported to freeluma_prod (31K users, 1.2K posts, 238 daily content)
- [x] PM2 ecosystem config + startup (2 cluster instances, auto-restart on reboot)
- [x] Nginx reverse proxy configured (HTTP→HTTPS redirect + SSL)
- [x] Cloudflare: DNS A records (@ and www → 178.156.239.61, proxied)
- [x] Cloudflare: Origin Certificate generated (15-year, RSA 2048) and installed
- [x] Cloudflare: SSL mode set to Full (Strict)
- [x] SSL cert files: /etc/ssl/freeluma-origin.pem + /etc/ssl/freeluma-origin-key.pem
- [x] End-to-end test — https://freeluma.app loading with auth working
