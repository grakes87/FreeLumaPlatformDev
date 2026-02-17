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
# App server
ssh root@178.156.239.61

# DB server
ssh root@178.156.243.11
```

SSH key: `~/.ssh/id_ed25519` (created on Mac, added to Hetzner as "Mac")

## App Server Stack

- **Node.js**: v20.20.0 (via NodeSource)
- **npm**: 10.8.2
- **PM2**: 6.0.14 (process manager)
- **Nginx**: 1.24.0 (reverse proxy + SSL termination)
- **Certbot**: 2.9.0 (installed but using Cloudflare Origin Certs instead)

## DB Server Stack

- **MySQL**: 8.0.45
- **Listening on**: 10.0.0.3:3306 (private network only)

## Database Connection (from app server)

```
DB_HOST=10.0.0.3
DB_PORT=3306
DB_NAME=freeluma_prod
DB_USER=freeluma_app
DB_PASSWORD=FL!pr0d#X8kM2vR7nQ4wJ9sT3yB6cH1
```

## Network Architecture

```
Users → Cloudflare (SSL + CDN + DDoS) → freeluma-app (178.156.239.61)
                                              ↓ private network
                                         freeluma-db (10.0.0.3:3306)
```

- DB server MySQL bound to private IP only (10.0.0.3)
- DB server port 3306 firewalled from public internet
- App server connects to DB via private network (sub-ms latency)
- Media served from Backblaze B2 (neither server handles files)

## Domain & SSL (pending)

- **Domain**: freeluma.com (on Cloudflare)
- **SSL**: Cloudflare Origin Certificate (15-year, RSA 2048)
- **SSL Mode**: Full (Strict)
- **DNS**: A record → 178.156.239.61 (proxied through Cloudflare)

## Deployment (TBD)

- App code: `/var/www/freeluma/`
- PM2 ecosystem config: `/var/www/freeluma/ecosystem.config.cjs`
- Nginx config: `/etc/nginx/sites-available/freeluma`
- Deploy method: TBD (git pull + build, or CI/CD)

## Setup Progress

- [x] Hetzner account created
- [x] SSH key generated and added
- [x] Private network created (freeluma-internal, us-east)
- [x] freeluma-app server created (CPX31, Ashburn)
- [x] freeluma-db server created (CPX21, Ashburn)
- [x] App server: Node.js, npm, PM2, Nginx, Certbot installed
- [x] App server: kernel rebooted
- [x] DB server: MySQL installed
- [x] DB server: MySQL secured and configured (bind 127.0.0.1 + 10.0.0.3)
- [x] DB server: Create freeluma_prod database and app user
- [x] DB server: Firewall — 3306 from 10.0.0.2 only, SSH from home IP
- [x] App→DB connection verified
- [ ] App server: Nginx configured
- [ ] App server: Deploy app code
- [ ] App server: PM2 ecosystem config
- [ ] App server: Environment variables (.env.local)
- [ ] Cloudflare: DNS A record pointing to app server
- [ ] Cloudflare: Origin Certificate generated and installed
- [ ] Cloudflare: SSL mode set to Full (Strict)
- [ ] End-to-end test
