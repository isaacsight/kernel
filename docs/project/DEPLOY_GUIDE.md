# Deployment Guide: Reliability Engine -> Fly.io

This guide explains how to deploy the **Reliability Engine** (`engine/` directory) to **Fly.io**. We chose Fly.io because it natively supports the `Dockerfile` we built and provides easy PostgreSQL integration.

## Prerequisites
1.  **Fly CLI**: [Install flyctl](https://fly.io/docs/hands-on/install-flyctl/)
2.  **Credit Card**: Fly.io requires a card for verification, even for the free tier.

---

## Step 1: Login & Initialize
Open your terminal in the project root.

```bash
# 1. Login to Fly
fly auth login

# 2. Navigate to the engine directory (IMPORTANT)
cd engine

# 3. Initialize the App
# - Choose a unique name (e.g., 'your-name-reliability-engine')
# - Select a region close to you (e.g., 'sjc' or 'lhr')
# - Respond 'Yes' to "Would you like to set up a Postgresql database now?"
# - Respond 'No' to "Components?" (Redis not needed)
fly launch
```

## Step 2: Configure Database & Secrets
Fly.io will automatically inject `DATABASE_URL` if you created the DB in step 1. You just need to set your app secrets.

```bash
# Generate a strong secret key
openssl rand -hex 32
# Output example: a1b2c3...

# Set secrets in Fly
fly secrets set SECRET_KEY=your_generated_key_here
fly secrets set STRIPE_WEBHOOK_SECRET=whsec_your_stripe_secret_here
```

## Step 3: Deploy
Push the code to the cloud.

```bash
fly deploy
```

## Step 4: Run Migrations
Once the app is running, the database is empty. You need to apply the schema.

```bash
# SSH into your running VM and run alembic
fly ssh console -C "python -m alembic upgrade head"
```

## Step 5: Verification
Your API is now live.

1.  **Public URL**: `https://<your-app-name>.fly.dev`
2.  **Docs**: Visit `https://<your-app-name>.fly.dev/docs` to see the Swagger UI.
3.  **Webhook**: Update Stripe Dashboard with `https://<your-app-name>.fly.dev/api/v1/stripe/webhook`.

## Troubleshooting
- **Logs**: Run `fly logs` to see real-time server output.
- **Restart**: Run `fly restart` if things get stuck.

---
**Status**: The Engine is now a production cloud service.
