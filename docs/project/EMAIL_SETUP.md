# Automatic Email Notifications - Setup Guide

## What This Does
Automatically sends emails to all your users when you publish a new post.

## Prerequisites
You need accounts for:
1. **Resend** (email service) - resend.com
2. **Supabase** (already have)
3. **GitHub** (already have)

## Setup Steps

### 1. Set Up Resend
1. Go to https://resend.com and sign up (free)
2. Verify your email
3. Go to **API Keys** and create a new key
4. Copy the API key (starts with `re_...`)
5. (Optional) Add your domain for better deliverability

### 2. Get Supabase Service Key
1. Go to your Supabase dashboard
2. Click **Settings** → **API**
3. Copy the **service_role** key (NOT the anon key)
   - ⚠️ This is sensitive - never commit it to code!

### 3. Add Secrets to GitHub
1. Go to your GitHub repo: https://github.com/isaacsight/does-this-feel-right-
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add these 3 secrets:

   **Secret 1:**
   - Name: `SUPABASE_URL`
   - Value: `https://kqsixkorzaulmeuynfkp.supabase.co`

   **Secret 2:**
   - Name: `SUPABASE_SERVICE_KEY`
   - Value: (your service_role key from Supabase)

   **Secret 3:**
   - Name: `RESEND_API_KEY`
   - Value: (your Resend API key)

### 4. Run SQL in Supabase
Copy the contents of `email_tracking.sql` and run it in your Supabase SQL Editor.

### 5. Test It!
1. Add a new post to `content/`
2. Run `python3 build.py`
3. Push to GitHub: `git add . && git commit -m "test" && git push`
4. GitHub will automatically send emails to all users!

## How It Works
- GitHub Action watches for changes to `content/` or `docs/`
- When you push, it runs `send_notifications.py`
- Script checks which posts haven't been emailed yet
- Sends beautiful HTML emails to all users
- Tracks which posts have been sent

## Monitoring
- Check GitHub Actions tab to see if emails were sent
- Look at Supabase `email_notifications` table to see history
