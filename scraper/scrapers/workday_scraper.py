"""Scrapes Workday career sites via their public JSON API."""

import time
import httpx
from config import WORKDAY_COMPANIES, SEARCH_TERMS, DELAY_BETWEEN_REQUESTS
from db import get_connection, create_scrape_run, update_scrape_run, upsert_job


def fetch_workday_jobs(tenant: str, dc: int, site: str, search_term: str) -> list[dict]:
    """Fetch jobs from a Workday career site's JSON API."""
    url = f"https://{tenant}.wd{dc}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs"

    jobs = []
    offset = 0
    limit = 20

    while True:
        try:
            response = httpx.post(
                url,
                json={
                    "appliedFacets": {},
                    "limit": limit,
                    "offset": offset,
                    "searchText": search_term,
                },
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                timeout=15,
            )

            if response.status_code != 200:
                break

            data = response.json()
            postings = data.get("jobPostings", [])

            if not postings:
                break

            for posting in postings:
                title = posting.get("title", "")
                location = posting.get("locationsText", posting.get("location", ""))
                external_path = posting.get("externalPath", "")

                job_url = f"https://{tenant}.wd{dc}.myworkdayjobs.com/en-US/{site}/job/{external_path}"

                jobs.append({
                    "title": title,
                    "company": tenant.capitalize(),
                    "location": location or None,
                    "job_url": job_url,
                    "apply_url": job_url,
                    "ats_platform": "workday",
                    "job_type": "internship",
                    "source": "workday",
                    "source_id": external_path,
                })

            offset += limit

            # Stop after 100 results per company/term combo
            if offset >= 100:
                break

            time.sleep(0.5)

        except Exception as e:
            print(f"[Workday] Error fetching {tenant}/{site}: {e}")
            break

    return jobs


def run():
    conn = get_connection()
    run_id = create_scrape_run(conn, "workday")
    total_found = 0
    total_new = 0

    try:
        for tenant, dc, site in WORKDAY_COMPANIES:
            for term in ["intern", "internship"]:
                print(f"[Workday] Checking {tenant} for '{term}'")

                try:
                    jobs = fetch_workday_jobs(tenant, dc, site, term)

                    for job_data in jobs:
                        # Filter: only intern-level roles
                        title_lower = job_data["title"].lower()
                        if not any(kw in title_lower for kw in ["intern", "co-op", "new grad"]):
                            continue

                        is_new = upsert_job(conn, job_data, run_id)
                        total_found += 1
                        if is_new:
                            total_new += 1

                except Exception as e:
                    print(f"[Workday] Error for {tenant}/{term}: {e}")

                time.sleep(DELAY_BETWEEN_REQUESTS)

        update_scrape_run(conn, run_id, "completed", total_found, total_new)
        print(f"[Workday] Done: {total_found} found, {total_new} new")

    except Exception as e:
        update_scrape_run(conn, run_id, "failed", total_found, total_new, str(e))
        print(f"[Workday] Failed: {e}")
    finally:
        conn.close()

    return total_found, total_new


if __name__ == "__main__":
    run()
