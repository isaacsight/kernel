# How to Configure Giscus Comments 💬

Follow these steps to get your comments working.

## 1. Prepare GitHub
1.  Go to your GitHub repository: [isaacsight/does-this-feel-right-](https://github.com/isaacsight/does-this-feel-right-)
2.  Click on **Settings** (top right tab).
3.  Scroll down to the **Features** section.
4.  Ensure the **Discussions** box is checked. ✅

## 2. Get Your IDs from Giscus
1.  Go to [giscus.app](https://giscus.app).
2.  **Repository**: Type `isaacsight/does-this-feel-right-`.
    *   *It should say "Success!"*
3.  **Page <-> Discussion Mapping**: Select **"Discussion title contains page pathname"**.
4.  **Discussion Category**: Select **"Announcements"** (or "General").
    *   *Note: I recommend "Announcements" so new posts automatically create a discussion there.*
5.  **Features**: Leave defaults.
6.  **Theme**: Select **"Preferred color scheme"** (this matches our Dark Mode).

## 3. Copy the IDs
Scroll down to the **"Enable giscus"** section. Look for the code block. You need two specific values from it:

*   `data-repo-id="Mw..."` (It will be a long string of random characters)
*   `data-category-id="DIC_..."` (Also a long string)

## 4. Update Your Code
1.  Open `templates/post.html`.
2.  Find the Giscus script (around line 44).
3.  Replace `[ENTER_REPO_ID_HERE]` with your **Repo ID**.
4.  Replace `[ENTER_CATEGORY_ID_HERE]` with your **Category ID**.
5.  Replace `[ENTER_REPO_HERE]` with `isaacsight/does-this-feel-right-`.

Save the file, and your comments will be live! 🚀
