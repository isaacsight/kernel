# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do NOT Open a Public Issue

Please do not disclose security vulnerabilities publicly until they have been addressed.

### 2. Email Us Directly

Send details to: **isaacsight@gmail.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### 3. Response Time

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity (see below)

## Vulnerability Severity

We classify vulnerabilities using this scale:

### Critical (Fix within 24-48 hours)
- Remote code execution
- Authentication bypass
- Data breach potential

### High (Fix within 7 days)
- SQL injection
- XSS attacks
- Credential exposure

### Medium (Fix within 30 days)
- CSRF vulnerabilities
- Information disclosure
- Denial of service

### Low (Fix when possible)
- Missing best practices
- Minor information leaks

## Security Best Practices

### For Contributors

1. **Never Commit Secrets**
   - No API keys in code
   - No passwords in files
   - Use `.env` for secrets (gitignored)
   - Use `.env.example` as template
   
2. **Handle Cookie Files**
   - **NEVER** commit `cookies.txt` or `sora_cookies.txt`
   - These contain sensitive session tokens (`oai-did`, etc.)
   - Ensure they are in `.gitignore` checking sensitive runtime state


3. **Validate All Inputs**
   - Sanitize user inputs
   - Validate file paths
   - Check data types
   - Prevent injection attacks

4. **Keep Dependencies Updated**
   - Run `pip-audit` regularly
   - Update vulnerable packages
   - Review dependency changes

5. **Use Security Tools**
   ```bash
   # Run security scans
   bash scripts/security_scan.sh

   # Check dependencies
   pip-audit

   # Scan code
   bandit -r . -ll
   ```

### For Deployment

1. **Environment Variables**
   - Never hardcode secrets
   - Use GitHub Secrets for CI/CD
   - Rotate keys regularly

2. **Access Control**
   - Limit repository access
   - Use branch protection
   - Require code reviews

3. **Monitoring**
   - Weekly security scans (GitHub Actions)
   - Dependency update alerts
   - Review security advisories

## Known Security Measures

### Current Protections

✅ **Secrets Management**
- `.env` files gitignored
- Template file (`.env.example`) provided
- No hardcoded credentials

✅ **Dependency Scanning**
- Automated `pip-audit` in CI/CD
- Bandit security linting
- Pre-commit hook checks

✅ **Code Quality**
- Automated linting (Ruff)
- Type checking (MyPy)
- Security-focused pre-commit hooks

✅ **CI/CD Security**
- Secrets stored in GitHub
- No credentials in workflows
- Tests run before deployment

### Planned Improvements

🔄 **Input Validation**
- Add file path sanitization
- Implement content security policy
- Validate all user inputs

🔄 **API Security**
- Rate limiting for AI calls
- API key rotation system
- Request validation

## Security Checklist for PRs

Before submitting a PR, ensure:

- [ ] No secrets in committed files
- [ ] All inputs are validated
- [ ] Dependencies are up-to-date
- [ ] Security scan passes (`bash scripts/security_scan.sh`)
- [ ] Tests cover security edge cases
- [ ] Documentation updated if security-related

## Dependency Security

### Monitoring

We use:
- **pip-audit**: Check for known vulnerabilities
- **safety**: Database of unsafe packages
- **Dependabot**: Automated dependency updates (GitHub)

### Update Process

```bash
# Check for vulnerabilities
pip-audit

# Update all dependencies
pip install --upgrade -r requirements.txt

# Test after updates
pytest

# If tests pass, commit
git add requirements.txt
git commit -m "chore: update dependencies"
```

## Incident Response

If a security incident occurs:

1. **Assess** the impact and scope
2. **Contain** the vulnerability immediately
3. **Fix** the issue in a private branch
4. **Test** the fix thoroughly
5. **Deploy** the fix to production
6. **Disclose** publicly after fix is live
7. **Post-mortem** to prevent recurrence

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Python Security Best Practices](https://python.readthedocs.io/en/stable/library/security_warnings.html)
- [Bandit Documentation](https://bandit.readthedocs.io/)
- [pip-audit Guide](https://pypi.org/project/pip-audit/)

## Contact

For security concerns:
- **Email**: isaacsight@gmail.com
- **Response Time**: Within 48 hours

For general questions:
- **GitHub Issues**: https://github.com/isaachernandez/blog-design/issues

---

**Last Updated**: November 2024

Thank you for helping keep this project secure! 🔒
