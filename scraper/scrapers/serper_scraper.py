"""Scrapes Google for Workday job postings via Serper.dev API."""

import time
import httpx
from config import SERPER_API_KEY, SEARCH_TERMS, DELAY_BETWEEN_REQUESTS
from db import get_connection, create_scrape_run, update_scrape_run, upsert_job


SERPER_URL = "https://google.serper.dev/search"


def run():
    if not SERPER_API_KEY:
        print("[Serper] No API key configured, skipping")
        return 0, 0

    conn = get_connection()
    run_id = create_scrape_run(conn, "serper")
    total_found = 0
    total_new = 0

    try:
        for term in SEARCH_TERMS:
            # Search Workday sites
            query = f'site:myworkdayjobs.com "{term}"'
            print(f"[Serper] Searching: {query}")

            try:
                response = httpx.post(
                    SERPER_URL,
                    headers={
                        "X-API-KEY": SERPER_API_KEY,
                        "Content-Type": "application/json",
                    },
                    json={
                        "q": query,
                        "num": 20,
                        "country": "US",
                    },
                    timeout=30,
                )
                response.raise_for_status()
                data = response.json()

                for result in data.get("organic", []):
                    link = result.get("link", "")
                    title = result.get("title", "")
                    snippet = result.get("snippet", "")

                    if not link or not title:
                        continue

                    # Try to extract company from the Workday URL
                    company = "Unknown"
                    if "myworkdayjobs.com" in link:
                        parts = link.split(".")
                        if len(parts) > 0:
                            company = parts[0].replace("https://", "").replace("http://", "").capitalize()

                    job_data = {
                        "title": title,
                        "company": company,
                        "location": None,
                        "job_url": link,
                        "description_raw": snippet,
                        "job_type": "internship",
                        "source": "serper",
                        "ats_platform": "workday",
                    }

                    is_new = upsert_job(conn, job_data, run_id)
                    total_found += 1
                    if is_new:
                        total_new += 1

            except Exception as e:
                print(f"[Serper] Error for '{term}': {e}")

            time.sleep(DELAY_BETWEEN_REQUESTS)

        update_scrape_run(conn, run_id, "completed", total_found, total_new)
        print(f"[Serper] Done: {total_found} found, {total_new} new")

    except Exception as e:
        update_scrape_run(conn, run_id, "failed", total_found, total_new, str(e))
        print(f"[Serper] Failed: {e}")
    finally:
        conn.close()

    return total_found, total_new


if __name__ == "__main__":
    run()
