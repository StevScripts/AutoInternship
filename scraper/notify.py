"""Triggers the Vercel API pipeline after scraping."""

import httpx
from config import API_URL, API_KEY


def trigger_scoring():
    """Call the Vercel API to score new jobs."""
    print("[Notify] Triggering job scoring pipeline...")
    try:
        response = httpx.post(
            f"{API_URL}/api/pipeline/score",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={},
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
        print(f"[Notify] Scoring done: {data}")
        return data
    except Exception as e:
        print(f"[Notify] Scoring failed: {e}")
        return None


def trigger_content_generation():
    """Call the Vercel API to generate content for matched jobs."""
    print("[Notify] Triggering content generation...")
    try:
        response = httpx.post(
            f"{API_URL}/api/pipeline/generate",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={"batch": True},
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
        print(f"[Notify] Content gen done: {data}")
        return data
    except Exception as e:
        print(f"[Notify] Content gen failed: {e}")
        return None


def trigger_discord_notification():
    """Call the Vercel API to send a Discord digest."""
    print("[Notify] Sending Discord notification...")
    try:
        response = httpx.post(
            f"{API_URL}/api/notify/discord",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={},
            timeout=30,
        )
        response.raise_for_status()
        print("[Notify] Discord notification sent")
    except Exception as e:
        print(f"[Notify] Discord notification failed: {e}")
