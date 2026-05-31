#!/usr/bin/env python3
"""Local submission watcher — polls Vercel for approved applications.

Runs on your Mac as a background daemon. Every 30 seconds, checks if
any applications have been approved. If so, immediately starts the
submission process via NoDriver.

No tunnel needed — your Mac pulls from the Vercel API, not the other way.

Usage:
    python3 submit_server.py

"""

import json
import os
import sys
import time
import httpx
from dotenv import load_dotenv

# Force unbuffered output for launchd
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

API_URL = os.environ.get("AUTOINTERNSHIP_API_URL", "http://localhost:3000")
API_KEY = os.environ.get("AUTOINTERNSHIP_API_KEY", "")
POLL_INTERVAL = 30  # seconds


def get_approved_applications() -> list[dict]:
    """Fetch applications with status 'approved' from Vercel API."""
    try:
        response = httpx.get(
            f"{API_URL}/api/applications?status=approved&limit=10",
            headers={"Authorization": f"Bearer {API_KEY}"},
            timeout=15,
        )
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        print(f"[Watcher] Failed to fetch approved apps: {e}")
        return []


def mark_submitting(application_id: str):
    """Update application status to 'submitting'."""
    try:
        httpx.patch(
            f"{API_URL}/api/applications/{application_id}",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={"status": "submitting"},
            timeout=10,
        )
    except Exception as e:
        print(f"[Watcher] Failed to mark {application_id} as submitting: {e}")


def mark_submitted(application_id: str):
    """Update application status to 'submitted'."""
    try:
        httpx.patch(
            f"{API_URL}/api/applications/{application_id}",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={"status": "submitted", "submittedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
            timeout=10,
        )
    except Exception as e:
        print(f"[Watcher] Failed to mark {application_id} as submitted: {e}")


def mark_failed(application_id: str, error: str):
    """Update application status to 'submission_failed'."""
    try:
        httpx.patch(
            f"{API_URL}/api/applications/{application_id}",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={"status": "submission_failed", "submissionError": error},
            timeout=10,
        )
    except Exception as e:
        print(f"[Watcher] Failed to mark {application_id} as failed: {e}")


def process_application(app_data: dict):
    """Fill out and submit a single application via SeleniumBase + Playwright."""
    application = app_data.get("application", {})
    job = app_data.get("job", {})
    application_id = application.get("id")

    title = job.get("title", "?")
    company = job.get("company", "?")
    print(f"[Watcher] Processing: {title} @ {company}")

    mark_submitting(application_id)

    from submitters.generic_submitter import submit_application
    result = submit_application({
        "application_id": application_id,
        "job": job,
        "application": application,
    })

    status = result.get("status", "error")

    if status == "filled":
        filled = result.get("fields_filled", 0)
        print(f"[Watcher] Filled {filled} fields for {title} @ {company}")
        mark_submitted(application_id)
    elif status == "error":
        error = result.get("error", "unknown")
        print(f"[Watcher] Failed: {title} @ {company} — {error}")
        mark_failed(application_id, error)
    else:
        print(f"[Watcher] Unexpected status '{status}' for {title} @ {company}")
        mark_submitted(application_id)

    print(f"[Watcher] Done: {title} @ {company}")


def main():
    print(f"[Watcher] Starting submission watcher")
    print(f"[Watcher] Polling {API_URL} every {POLL_INTERVAL}s for approved applications")
    print(f"[Watcher] Press Ctrl+C to stop")

    while True:
        try:
            approved = get_approved_applications()

            if approved:
                print(f"[Watcher] Found {len(approved)} approved application(s)")
                for app_data in approved:
                    process_application(app_data)

            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            print("\n[Watcher] Shutting down")
            break
        except Exception as e:
            print(f"[Watcher] Error: {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
