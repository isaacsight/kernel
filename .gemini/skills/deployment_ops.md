---
name: deployment_ops
description: Production deployment strategies, CI/CD pipeline management, and infrastructure operations.
---

# Deployment Operations Skill

This skill provides comprehensive guidance for deploying, monitoring, and maintaining production systems with zero-downtime strategies.

## Deployment Strategies

### 1. Blue-Green Deployment
```
┌─────────────────┐     ┌─────────────────┐
│   BLUE (Live)   │     │  GREEN (Staged) │
│   v1.0.0        │     │   v1.1.0        │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────┬───────────────┘
                 │
         ┌───────▼───────┐
         │  Load Balancer │
         │  (Switch traffic)
         └───────────────┘
```

**When to use**:
- Need instant rollback capability
- Can afford running two environments
- Stateless applications

### 2. Canary Deployment
```
Traffic Distribution:
├── 95% → Stable (v1.0.0)
└──  5% → Canary (v1.1.0)  ← Monitor for errors

Gradual rollout: 5% → 25% → 50% → 100%
```

**When to use**:
- Risk-averse releases
- Need to validate with real traffic
- Large user bases

### 3. Rolling Deployment
```
Instance Pool: [A] [B] [C] [D]

Step 1: Update A → [A*] [B] [C] [D]
Step 2: Update B → [A*] [B*] [C] [D]
Step 3: Update C → [A*] [B*] [C*] [D]
Step 4: Update D → [A*] [B*] [C*] [D*]
```

**When to use**:
- Limited infrastructure budget
- Can tolerate mixed versions briefly
- Kubernetes default strategy

## CI/CD Pipeline Structure

### GitHub Actions Example
```yaml
name: Deploy Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Tests
        run: |
          npm ci
          npm test
          npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: npm run build
      - name: Upload Artifact
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Staging
        run: ./deploy.sh staging

  deploy-production:
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    environment: production
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: ./deploy.sh production
```

## Infrastructure Targets

### Fly.io (Sovereign Lab Default)
```bash
# Deploy
fly deploy --app sovereign-lab

# Scale
fly scale count 3 --app sovereign-lab

# Logs
fly logs --app sovereign-lab

# Secrets
fly secrets set DATABASE_URL="postgres://..."
```

### Vercel (Frontend)
```bash
# Deploy preview
vercel

# Deploy production
vercel --prod

# Environment variables
vercel env add NEXT_PUBLIC_API_URL
```

### Railway
```bash
# Deploy
railway up

# Logs
railway logs

# Variables
railway variables set KEY=value
```

### Docker Compose (Self-hosted)
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
```

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing
- [ ] No linting errors
- [ ] Security scan clean
- [ ] Dependencies up to date

### Database
- [ ] Migrations are reversible
- [ ] Migrations tested on staging
- [ ] Backup taken before migration
- [ ] Index impact analyzed

### Configuration
- [ ] Environment variables set
- [ ] Secrets rotated if needed
- [ ] Feature flags configured
- [ ] Monitoring alerts set

### Communication
- [ ] Team notified of deployment
- [ ] Changelog updated
- [ ] Status page updated (if applicable)
- [ ] Rollback plan documented

## Rollback Procedures

### Immediate Rollback
```bash
# Fly.io
fly releases list
fly deploy --image registry.fly.io/app:v1.0.0

# Kubernetes
kubectl rollout undo deployment/app

# Docker Compose
docker-compose up -d --no-build previous-image

# Git-based
git revert HEAD && git push
```

### Database Rollback
```sql
-- Check current migration
SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;

-- Rollback last migration
-- (Use your ORM's rollback command)
alembic downgrade -1
```

## Monitoring Post-Deploy

### Key Metrics to Watch
1. **Error Rate**: Should stay below baseline
2. **Response Time**: P50, P95, P99 latencies
3. **Throughput**: Requests per second
4. **CPU/Memory**: Resource utilization
5. **Database**: Connection pool, query time

### Health Check Endpoints
```python
# FastAPI health check
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "version": os.getenv("APP_VERSION"),
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {
            "database": await check_db(),
            "cache": await check_cache(),
        }
    }
```

## Tools Integrated
- `shell` (deployment commands)
- `view_file_outline` (config inspection)
- `web_search` (documentation lookup)
- `task_boundary` (deployment milestones)

## Quick Commands Reference

```bash
# Pre-deploy checks
npm run test && npm run lint && npm run build

# Database backup (PostgreSQL)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# SSL certificate check
openssl s_client -connect example.com:443 -servername example.com

# DNS propagation check
dig +short example.com @8.8.8.8

# Container logs (last 100 lines, follow)
docker logs -f --tail 100 container_name

# Port availability
lsof -i :8000
```

---
*Skill v1.0 | Sovereign Laboratory OS | Deployment Operations*
