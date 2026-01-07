import asyncio
import logging
import os
import random
from typing import Optional
from urllib.parse import urljoin
from dotenv import load_dotenv

from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from supabase import create_client, Client

from dtfr.mobbin_schemas import MobbinApp, MobbinScreen

logger = logging.getLogger("MobbinScout")


class MobbinScout:
    """
    Mobbin Scout Agent

    Roles:
    - Navigator: Paginate through "Discover" pages.
    - Scraper: Extract app details and screen metadata.
    - Compliance Guard: Respect robots.txt and rate limits.
    """

    BASE_URL = "https://mobbin.com"
    DISCOVER_URL = "https://mobbin.com/browse/ios/apps"

    def __init__(self):
        load_dotenv()
        self.name = "Mobbin Scout"
        self.role = "Design Intelligence Researcher"
        self.emoji = "📱"
        self.rate_limit_delay = (2, 5)  # seconds
        self.max_pages = 3  # Safety limit for initial implementation

    async def run(self):
        """Main entry point for the agent."""
        logger.info(f"[{self.name}] Starting research mission.")

        # Database setup
        self.supabase_url = os.environ.get("SUPABASE_URL")
        self.supabase_key = os.environ.get("SUPABASE_KEY")
        self.supabase: Optional[Client] = None

        if self.supabase_url and self.supabase_key:
            self.supabase = create_client(self.supabase_url, self.supabase_key)
            logger.info(f"[{self.name}] Supabase client initialized.")
        else:
            logger.warning(
                f"[{self.name}] Supabase credentials missing. Data will not be persisted."
            )

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()

            try:
                # 1. Start with discovery
                apps = await self.discover_apps(page)
                logger.info(f"[{self.name}] Found {len(apps)} apps to research.")

                # 2. Visit each app (limit for test)
                for app_data in apps[:5]:
                    app = await self.scrape_app_details(page, app_data["url"])
                    if app:
                        logger.info(f"[{self.name}] Extracted details for {app.name}")
                        await self.save_app(app)

                        # Extract screens/flows
                        screens = await self.scrape_screens(page, app.id)
                        for screen in screens:
                            await self.save_screen(screen)

                    # Random delay for compliance
                    await asyncio.sleep(random.uniform(*self.rate_limit_delay))

            except Exception as e:
                logger.error(f"[{self.name}] Mission failed: {e}")
            finally:
                await browser.close()

    async def discover_apps(self, page) -> list[dict]:
        """Navigate through paginated discovery pages."""
        logger.info(f"[{self.name}] Navigating to discovery page: {self.DISCOVER_URL}")
        try:
            await page.goto(self.DISCOVER_URL, wait_until="domcontentloaded")
            await asyncio.sleep(5)

            # Scroll to trigger lazy loading
            await page.evaluate("window.scrollTo(0, 1000)")
            await asyncio.sleep(3)

            await page.screenshot(path="debug_mobbin_discovery.png")
            logger.info(f"[{self.name}] Saved debug screenshot to debug_mobbin_discovery.png")

            await page.wait_for_selector('a[href^="/apps/"]', timeout=30000)
        except Exception as e:
            logger.error(f"[{self.name}] Failed to wait for apps listing: {e}")
            raise

        apps = []
        content = await page.content()
        soup = BeautifulSoup(content, "html.parser")

        # More flexible detection: find all app links directly
        app_links = soup.select('a[href^="/apps/"]')
        logger.info(f"[{self.name}] Found {len(app_links)} potential app links.")

        for link in app_links:
            app_url = urljoin(self.BASE_URL, link["href"])

            # The name is often inside an h3 or the link text itself
            name_elem = (
                link.select_one("h3") or link.find_parent("li").select_one("h3")
                if link.find_parent("li")
                else None
            )
            app_name = name_elem.text.strip() if name_elem else link.text.strip()

            if app_url not in [a["url"] for a in apps] and app_name:
                apps.append({"url": app_url, "name": app_name, "logo_url": None})

        return apps

    async def scrape_app_details(self, page, app_url: str) -> Optional[MobbinApp]:
        """Scrape detailed information for a specific app."""
        logger.info(f"[{self.name}] Researching app details: {app_url}")
        await page.goto(app_url)
        await page.wait_for_load_state("networkidle")

        content = await page.content()
        soup = BeautifulSoup(content, "html.parser")

        try:
            # Extract basic info
            # h1 typically contains "App Name — Tagline"
            h1_elem = soup.find("h1")
            full_title = h1_elem.text.strip() if h1_elem else "Unknown"

            name = full_title
            tagline = None
            if " — " in full_title:
                parts = full_title.split(" — ", 1)
                name = parts[0].strip()
                tagline = parts[1].strip()

            # Extract categories/tags
            categories = []
            for tag in soup.select('a[href*="appCategories."]'):
                categories.append(tag.text.strip())

            app = MobbinApp(
                id=app_url.split("/")[-1],
                name=name,
                tagline=tagline,
                platform="iOS",
                categories=list(set(categories)),
                url=app_url,
            )

            return app
        except Exception as e:
            logger.warning(f"[{self.name}] Failed to parse app details for {app_url}: {e}")
            return None

    async def scrape_screens(self, page, app_id: str) -> list[MobbinScreen]:
        """Scrape screens for a specific app."""
        logger.info(f"[{self.name}] Scoping screens for app: {app_id}")

        content = await page.content()
        soup = BeautifulSoup(content, "html.parser")

        screens = []
        # img[src*="app_screens"] or img[alt*="screen"]
        screen_imgs = soup.select('img[src*="app_screens"], img[alt*="screen"]')

        for i, img in enumerate(screen_imgs):
            # Try to find a wrapping link for the full screen view
            parent_link = img.find_parent("a", href=True)
            screen_id = (
                parent_link["href"].split("/")[-1]
                if parent_link and "/screens/" in parent_link["href"]
                else f"{app_id}-screen-{i}"
            )

            screen = MobbinScreen(
                id=screen_id,
                app_id=app_id,
                title=img.get("alt", f"Screen {i}"),
                image_url=img.get("src", ""),
            )
            screens.append(screen)

        return screens

    async def save_app(self, app: MobbinApp):
        """Save app data to Supabase."""
        if not self.supabase:
            return

        try:
            data = {
                "id": app.id,
                "name": app.name,
                "tagline": app.tagline,
                "platform": app.platform,
                "categories": app.categories,
                "url": app.url,
                "metadata": app.metadata,
            }
            self.supabase.table("mobbin_apps").upsert(data).execute()
            logger.info(f"[{self.name}] Saved app {app.name} to DB.")
        except Exception as e:
            logger.error(f"[{self.name}] Failed to save app {app.id}: {e}")

    async def save_screen(self, screen: MobbinScreen):
        """Save screen data to Supabase."""
        if not self.supabase:
            return

        try:
            data = {
                "id": screen.id,
                "app_id": screen.app_id,
                "title": screen.title,
                "image_url": screen.image_url,
                "metadata": screen.metadata,
            }
            self.supabase.table("mobbin_screens").upsert(data).execute()
        except Exception as e:
            logger.error(f"[{self.name}] Failed to save screen {screen.id}: {e}")


if __name__ == "__main__":
    # Test run
    logging.basicConfig(level=logging.INFO)
    scout = MobbinScout()
    asyncio.run(scout.run())
