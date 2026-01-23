# /deploy - Deployment Operations Command

Execute deployment workflows with pre-flight checks and rollback planning.

## Usage
```
/deploy [target]
/deploy staging
/deploy production --dry-run
```

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing
- [ ] No linting errors
- [ ] Security scan clean

### Database
- [ ] Migrations tested on staging
- [ ] Backup taken
- [ ] Rollback plan documented

### Configuration
- [ ] Environment variables set
- [ ] Feature flags configured
- [ ] Monitoring alerts active

## Deployment Targets

### Fly.io (Backend)
```bash
fly deploy --app sovereign-lab
fly scale count 3
fly logs
```

### Vercel (Frontend)
```bash
vercel --prod
vercel env add
```

### GitHub Pages (Static)
```bash
npm run build
git push origin main
```

## Rollback Commands
```bash
# Fly.io
fly deploy --image registry.fly.io/app:v1.0.0

# Git-based
git revert HEAD && git push
```

## Related Skills
- Gemini: `deployment_ops`
- See: `.gemini/skills/deployment_ops.md`
