import hashlib
import psycopg2
import psycopg2.extras
from config import DATABASE_URL


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def compute_fingerprint(company: str, title: str, location: str | None) -> str:
    normalized = "|".join([
        company.lower().strip(),
        title.lower().strip(),
        (location or "unknown").lower().strip(),
    ])
    # Normalize whitespace
    normalized = " ".join(normalized.split())
    return hashlib.sha256(normalized.encode()).hexdigest()


def create_scrape_run(conn, source: str) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO scrape_runs (source, status)
               VALUES (%s, 'running') RETURNING id""",
            (source,),
        )
        run_id = str(cur.fetchone()[0])
        conn.commit()
        return run_id


def update_scrape_run(conn, run_id: str, status: str, jobs_found: int, jobs_new: int, error_log: str | None = None):
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE scrape_runs
               SET status = %s, finished_at = now(), jobs_found = %s, jobs_new = %s, error_log = %s
               WHERE id = %s""",
            (status, jobs_found, jobs_new, error_log, run_id),
        )
        conn.commit()


def upsert_job(conn, job_data: dict, scrape_run_id: str) -> bool:
    """Insert a job, returns True if new, False if duplicate."""
    fp = compute_fingerprint(
        job_data["company"], job_data["title"], job_data.get("location")
    )
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO jobs (
                fingerprint, title, company, company_logo_url, location,
                is_remote, job_url, apply_url, ats_platform,
                description_raw, salary_min, salary_max, salary_period,
                job_type, date_posted, source, source_id, scrape_run_id, status
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s, 'scraped'
            )
            ON CONFLICT (fingerprint) DO UPDATE SET updated_at = now()
            RETURNING (xmax = 0) AS is_new""",
            (
                fp,
                job_data["title"],
                job_data["company"],
                job_data.get("company_logo_url"),
                job_data.get("location"),
                job_data.get("is_remote", False),
                job_data["job_url"],
                job_data.get("apply_url"),
                job_data.get("ats_platform"),
                job_data.get("description_raw"),
                job_data.get("salary_min"),
                job_data.get("salary_max"),
                job_data.get("salary_period"),
                job_data.get("job_type", "internship"),
                job_data.get("date_posted"),
                job_data["source"],
                job_data.get("source_id"),
                scrape_run_id,
            ),
        )
        result = cur.fetchone()
        conn.commit()
        return result[0] if result else False
