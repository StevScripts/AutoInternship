"""Stealth browser scraper using SeleniumBase CDP + Stealthy Playwright.

Scrapes:
1. Google search for recent Workday postings (site:myworkdayjobs.com, last 24h)
2. Handshake (using existing browser session)

Uses SeleniumBase's Stealthy Playwright Mode to avoid bot detection.
"""

import time
from playwright.sync_api import sync_playwright
from seleniumbase import sb_cdp
from config import SEARCH_TERMS, DELAY_BETWEEN_REQUESTS
from db import get_connection, create_scrape_run, update_scrape_run, upsert_job


def scrape_google_jobs(page, sb):
    """Search Google for recent Workday job postings."""
    jobs_found = []

    search_queries = [
        'site:myworkdayjobs.com "software engineering intern"',
        'site:myworkdayjobs.com "software engineer intern"',
        'site:myworkdayjobs.com "AI intern"',
        'site:myworkdayjobs.com "machine learning intern"',
        'site:myworkdayjobs.com "full stack intern"',
    ]

    for query in search_queries:
        try:
            print(f"[Stealth] Google search: {query}")

            # Navigate to Google and search
            page.goto("https://www.google.com", wait_until="domcontentloaded")
            page.wait_for_timeout(1500)

            # Type search query
            search_box = page.locator('textarea[name="q"], input[name="q"]').first
            search_box.fill(query)
            page.wait_for_timeout(500)
            search_box.press("Enter")
            page.wait_for_timeout(3000)

            # Click "Tools" then filter by "Past 24 hours" if available
            try:
                tools_btn = page.locator('div:has-text("Tools")').first
                if tools_btn.is_visible():
                    tools_btn.click()
                    page.wait_for_timeout(1000)

                    # Look for time filter
                    time_filter = page.locator('div:has-text("Any time")').first
                    if time_filter.is_visible():
                        time_filter.click()
                        page.wait_for_timeout(500)
                        past_24h = page.locator('a:has-text("Past 24 hours"), span:has-text("Past 24 hours")').first
                        if past_24h.is_visible():
                            past_24h.click()
                            page.wait_for_timeout(2000)
            except Exception:
                pass  # If time filter fails, proceed with unfiltered results

            # Extract search results
            results = page.locator("div.g, div[data-hveid]").all()

            for result in results[:15]:  # Top 15 results
                try:
                    link_el = result.locator("a[href*='myworkdayjobs.com']").first
                    if not link_el.is_visible():
                        continue

                    href = link_el.get_attribute("href")
                    title_el = result.locator("h3").first
                    title = title_el.text_content() if title_el.is_visible() else ""
                    snippet_el = result.locator("div[data-sncf], span[class]").first
                    snippet = snippet_el.text_content() if snippet_el.is_visible() else ""

                    if not href or not title:
                        continue

                    # Extract company from Workday URL
                    company = "Unknown"
                    if "myworkdayjobs.com" in href:
                        parts = href.split(".")
                        if parts:
                            company = parts[0].replace("https://", "").replace("http://", "").capitalize()

                    jobs_found.append({
                        "title": title.strip(),
                        "company": company,
                        "location": None,
                        "job_url": href,
                        "apply_url": href,
                        "description_raw": snippet.strip() if snippet else None,
                        "ats_platform": "workday",
                        "job_type": "internship",
                        "source": "google_stealth",
                    })
                except Exception:
                    continue

            time.sleep(DELAY_BETWEEN_REQUESTS + 2)  # Extra delay for Google

        except Exception as e:
            print(f"[Stealth] Google search error for '{query}': {e}")

    return jobs_found


def scrape_handshake(page, sb):
    """Scrape Handshake for internship postings using existing session.

    Requires the user to be logged into Handshake in their Chrome profile.
    """
    jobs_found = []

    try:
        print("[Stealth] Checking Handshake...")
        page.goto("https://app.joinhandshake.com/stu/postings?category=Internship&sort_direction=desc&sort_column=created_at", wait_until="domcontentloaded")
        page.wait_for_timeout(3000)

        # Check if we're logged in
        if "sign_in" in page.url or "login" in page.url:
            print("[Stealth] Not logged into Handshake. Skipping.")
            return jobs_found

        # Wait for job cards to load
        page.wait_for_timeout(2000)

        # Extract job listings
        cards = page.locator('[data-testid="posting-card"], div[class*="posting"], a[href*="/postings/"]').all()

        for card in cards[:20]:
            try:
                link_el = card.locator("a[href*='/postings/']").first
                href = link_el.get_attribute("href") if link_el.is_visible() else None

                if not href:
                    continue

                if not href.startswith("http"):
                    href = f"https://app.joinhandshake.com{href}"

                title = ""
                company = ""

                title_el = card.locator("h3, [class*='title'], [class*='name']").first
                if title_el.is_visible():
                    title = title_el.text_content().strip()

                company_el = card.locator("[class*='employer'], [class*='company'], [class*='org']").first
                if company_el.is_visible():
                    company = company_el.text_content().strip()

                if not title:
                    continue

                jobs_found.append({
                    "title": title,
                    "company": company or "Unknown",
                    "location": None,
                    "job_url": href,
                    "apply_url": href,
                    "ats_platform": "handshake",
                    "job_type": "internship",
                    "source": "handshake",
                })
            except Exception:
                continue

        print(f"[Stealth] Found {len(jobs_found)} Handshake postings")

    except Exception as e:
        print(f"[Stealth] Handshake error: {e}")

    return jobs_found


def run():
    """Run stealth browser scraping with SeleniumBase + Playwright."""
    conn = get_connection()
    run_id = create_scrape_run(conn, "stealth_browser")
    total_found = 0
    total_new = 0

    try:
        print("[Stealth] Launching stealth browser (SeleniumBase CDP + Playwright)...")

        # Launch stealth browser via SeleniumBase
        sb = sb_cdp.Chrome(locale="en")
        endpoint_url = sb.get_endpoint_url()

        with sync_playwright() as p:
            # Connect Playwright to the stealth session
            browser = p.chromium.connect_over_cdp(endpoint_url)
            page = browser.contexts[0].pages[0]

            # 1. Scrape Google for recent Workday postings
            print("\n[Stealth] --- Google Workday Search ---")
            google_jobs = scrape_google_jobs(page, sb)
            for job_data in google_jobs:
                is_new = upsert_job(conn, job_data, run_id)
                total_found += 1
                if is_new:
                    total_new += 1

            time.sleep(3)

            # 2. Scrape Handshake
            print("\n[Stealth] --- Handshake ---")
            handshake_jobs = scrape_handshake(page, sb)
            for job_data in handshake_jobs:
                is_new = upsert_job(conn, job_data, run_id)
                total_found += 1
                if is_new:
                    total_new += 1

        sb.driver.stop()

        update_scrape_run(conn, run_id, "completed", total_found, total_new)
        print(f"[Stealth] Done: {total_found} found, {total_new} new")

    except Exception as e:
        update_scrape_run(conn, run_id, "failed", total_found, total_new, str(e))
        print(f"[Stealth] Failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

    return total_found, total_new


if __name__ == "__main__":
    run()
