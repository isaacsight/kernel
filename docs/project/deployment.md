# Deployment Guide: Does This Feel Right?

## Part 1: Backend Setup (Supabase)
1.  **Sign Up:** Go to [Supabase.com](https://supabase.com) and create a free account.
2.  **New Project:** Create a new project (e.g., "does-this-feel-right").
3.  **Get Keys:**
    *   Go to **Settings** -> **API**.
    *   Copy the **Project URL**.
    *   Copy the **anon / public** Key.
    *   **Action:** Paste these into `static/js/config.js` in your code.
4.  **Setup Database:**
    *   Go to **SQL Editor** in the Supabase dashboard.
    *   Click **New Query**.
    *   Copy the contents of `setup_supabase.sql` from your project.
    *   Paste it into the editor and click **Run**.
    *   *Result:* This creates the `user_bookmarks` table and sets up security rules.

## Part 2: Hosting (Netlify)
1.  **Sign Up:** Go to [Netlify.com](https://netlify.com) and sign up.
2.  **Deploy:**
    *   Run `python3 build.py` locally to ensure your `docs/` folder is fresh.
    *   Drag and drop the `docs/` folder into the Netlify dashboard ("Sites" tab).
    *   *Result:* Your site is live! (e.g., `random-name-123.netlify.app`).

## Part 3: Custom Domain
1.  **Buy Domain:** You can buy a domain on Netlify or any registrar (Namecheap, GoDaddy, etc.).
2.  **Connect:**
    *   In Netlify, go to **Site Settings** -> **Domain Management**.
    *   Click **Add a domain**.
    *   Follow the instructions to verify ownership.
3.  **Update Code:**
    *   Open `build.py`.
    *   Change `BASE_URL` to your new domain (e.g., `https://www.doesthisfeelright.com`).
    *   Run `python3 build.py` and redeploy (drag-and-drop `docs/` again).
