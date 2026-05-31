#!/usr/bin/env python3
"""AutoInternship Scraper — main orchestrator.

Runs all scrapers sequentially, then triggers the Vercel API pipeline
for scoring, content generation, and Discord notification.

Designed to be called by launchd at 6am, 12pm, and 12am.
"""

import sys
import time
import socket
from datetime import datetime

from scrapers import jobspy_scraper, serper_scraper, workday_scraper
from notify import trigger_scoring, trigger_content_generation, trigger_discord_notification


def check_internet(timeout: int = 5) -> bool:
    """Check internet connectivity."""
    try:
        socket.create_connection(("8.8.8.8", 53), timeout=timeout)
        return True
    except OSError:
        return False


def wait_for_internet(max_retries: int = 15, interval: int = 120):
    """Wait for internet, retrying every 2 minutes."""
    for attempt in range(max_retries):
        if check_internet():
            return True
        print(f"[Main] No internet (attempt {attempt + 1}/{max_retries}), retrying in {interval}s...")
        time.sleep(interval)
    return False


def main():
    start = datetime.now()
    print(f"\n{'='*60}")
    print(f"[Main] AutoInternship scraper starting at {start.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    # Wait for internet connectivity
    if not wait_for_internet():
        print("[Main] No internet after retries. Exiting.")
        sys.exit(1)

    total_found = 0
    total_new = 0

    # Run scrapers
    scrapers = [
        ("JobSpy", jobspy_scraper.run),
        ("Serper", serper_scraper.run),
        ("Workday", workday_scraper.run),
    ]

    for name, scraper_fn in scrapers:
        try:
            print(f"\n--- Running {name} ---")
            found, new = scraper_fn()
            total_found += found
            total_new += new
        except Exception as e:
            print(f"[Main] {name} crashed: {e}")

        time.sleep(2)  # Brief pause between sources

    print(f"\n[Main] Scraping complete: {total_found} found, {total_new} new")

    # Trigger AI pipeline on Vercel
    if total_new > 0:
        trigger_scoring()
        time.sleep(2)
        trigger_content_generation()
        time.sleep(1)

    # Always send a Discord notification
    trigger_discord_notification()

    elapsed = (datetime.now() - start).total_seconds()
    print(f"\n[Main] Finished in {elapsed:.1f}s")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
