"""Scrapes Indeed, Glassdoor, Google Jobs, ZipRecruiter via python-jobspy."""

import time
from jobspy import scrape_jobs
from config import SEARCH_TERMS, LOCATIONS, HOURS_OLD, DELAY_BETWEEN_REQUESTS
from db import get_connection, create_scrape_run, update_scrape_run, upsert_job


def run():
    conn = get_connection()
    run_id = create_scrape_run(conn, "jobspy")
    total_found = 0
    total_new = 0

    try:
        for term in SEARCH_TERMS:
            for location in LOCATIONS:
                print(f"[JobSpy] Searching: '{term}' in {location}")
                try:
                    jobs_df = scrape_jobs(
                        site_name=["indeed", "glassdoor", "google", "zip_recruiter"],
                        search_term=term,
                        location=location,
                        results_wanted=30,
                        hours_old=HOURS_OLD,
                        job_type="internship",
                    )

                    for _, row in jobs_df.iterrows():
                        job_data = {
                            "title": str(row.get("title", "")),
                            "company": str(row.get("company", "Unknown")),
                            "location": str(row.get("location", "")) or None,
                            "is_remote": bool(row.get("is_remote", False)),
                            "job_url": str(row.get("job_url", "")),
                            "description_raw": str(row.get("description", "")) or None,
                            "salary_min": int(row["min_amount"]) if row.get("min_amount") else None,
                            "salary_max": int(row["max_amount"]) if row.get("max_amount") else None,
                            "salary_period": str(row.get("interval", "")) or None,
                            "job_type": "internship",
                            "date_posted": str(row.get("date_posted", "")) or None,
                            "source": "jobspy",
                            "source_id": str(row.get("id", "")) or None,
                        }

                        if not job_data["title"] or not job_data["job_url"]:
                            continue

                        is_new = upsert_job(conn, job_data, run_id)
                        total_found += 1
                        if is_new:
                            total_new += 1

                except Exception as e:
                    print(f"[JobSpy] Error for '{term}' in {location}: {e}")

                time.sleep(DELAY_BETWEEN_REQUESTS)

        update_scrape_run(conn, run_id, "completed", total_found, total_new)
        print(f"[JobSpy] Done: {total_found} found, {total_new} new")

    except Exception as e:
        update_scrape_run(conn, run_id, "failed", total_found, total_new, str(e))
        print(f"[JobSpy] Failed: {e}")
    finally:
        conn.close()

    return total_found, total_new


if __name__ == "__main__":
    run()
