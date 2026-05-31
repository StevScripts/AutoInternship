#!/usr/bin/env python3
"""Quick apply — paste a job URL and watch it fill everything out.

Usage:
    python3 apply.py "https://company.wd5.myworkdayjobs.com/..."

The script will:
1. Launch a stealth browser
2. Navigate to the URL
3. Detect all form fields
4. Ask Claude what to fill in each field
5. Fill everything out
6. Upload your resume
7. Take a screenshot
8. Leave the browser OPEN so you can review and submit manually
"""

import sys
import os
import time
import json
import re
import anthropic
from playwright.sync_api import sync_playwright
from seleniumbase import sb_cdp
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
RESUME_PATH = os.path.join(os.path.dirname(__file__), "..", "resume.pdf")

PROFILE = {
    "full_name": "Stevin George",
    "email": "steving2006@gmail.com",
    "phone": "407-257-0293",
    "linkedin": "https://linkedin.com/in/georgestevin",
    "github": "https://github.com/StevScripts",
    "portfolio": "https://stevin.dev",
    "university": "University of Central Florida",
    "degree": "B.S. in Computer Science",
    "graduation_date": "May 2028",
    "gpa": "3.5",
    "work_authorization": "US Citizen",
    "sponsorship_required": "No",
    "skills": "Java, Python, SQL, TypeScript, JavaScript, C, HTML, CSS, Spring Boot, Flask, Next.js, React, React Native, Node.js, Prisma, Tailwind CSS, AWS, Docker, CI/CD, PostgreSQL, Vercel, Git, OpenCV, YOLOv8, TensorFlow Lite, Gemini API, ElevenLabs, ChromaDB, N8N, AI Automations",
}


def extract_fields(page):
    """Extract visible form fields from the page."""
    return page.evaluate("""() => {
        const fields = [];
        const inputs = document.querySelectorAll(
            'input[type="text"], input[type="email"], input[type="tel"], ' +
            'input[type="url"], input[type="number"], textarea, select'
        );
        inputs.forEach((el, i) => {
            if (el.offsetParent === null && el.type !== 'hidden') return;
            if (el.type === 'hidden') return;

            let label = '';
            const labelEl = el.closest('label') || document.querySelector('label[for="' + el.id + '"]');
            if (labelEl) label = labelEl.textContent.trim();
            if (!label) label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || '';
            if (!label) {
                const automationId = el.getAttribute('data-automation-id');
                if (automationId) label = automationId.replace(/([A-Z])/g, ' $1').trim();
            }
            if (!label) {
                const parent = el.closest('[class*="label"], [class*="field"], [class*="question"]');
                if (parent) label = parent.textContent.trim().substring(0, 150);
            }

            let options = null;
            if (el.tagName === 'SELECT') {
                options = Array.from(el.options).map(o => o.textContent.trim()).join(', ');
            }

            let selector = '';
            if (el.id) selector = '#' + CSS.escape(el.id);
            else if (el.name) selector = '[name="' + el.name + '"]';
            else {
                const idx = Array.from(el.parentElement.children).filter(c => c.tagName === el.tagName).indexOf(el) + 1;
                selector = el.tagName.toLowerCase() + ':nth-of-type(' + idx + ')';
            }

            fields.push({
                index: i,
                label: label.substring(0, 200),
                type: el.tagName === 'SELECT' ? 'select' : (el.type || 'text'),
                options: options,
                currentValue: el.value || '',
                selector: selector
            });
        });
        return fields;
    }""")


def extract_job_description(page):
    """Extract job description text from the page."""
    return page.evaluate("""() => {
        const selectors = [
            '[data-automation-id="jobPostingDescription"]',
            '.job-description', '.posting-description', '.job-details',
            '[class*="description"]', '[class*="posting"]', 'article', 'main'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent.trim().length > 100) {
                return el.textContent.trim().substring(0, 3000);
            }
        }
        return document.body.textContent.trim().substring(0, 3000);
    }""")


def ask_claude(fields, job_description, url):
    """Ask Claude to fill the form fields."""
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    profile_text = "\n".join(f"  {k}: {v}" for k, v in PROFILE.items())
    fields_text = "\n".join(
        f'[{f["index"]}] Label: "{f["label"]}" | Type: {f["type"]} | Options: {f["options"] or "none"} | Current: "{f["currentValue"]}"'
        for f in fields
    )

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system="""You fill out job application forms for a college student. Match field labels to profile data.

RULES:
- Name/email/phone/LinkedIn/GitHub: use exact profile values
- Work authorization: "Yes" or "Authorized to work"
- Sponsorship: "No"
- For open-ended questions: write 2-3 specific sentences. Sound like a real student.
- For select dropdowns: pick the best matching option text
- Skip already-filled fields and file upload fields
- NEVER use: leverage, utilize, passionate, innovative, dynamic, driven, delve
- Use contractions. Be direct.""",
        messages=[{
            "role": "user",
            "content": f"""Fill these fields.

PROFILE:
{profile_text}

JOB URL: {url}
JOB DESCRIPTION:
{job_description[:1500]}

FIELDS:
{fields_text}

Return ONLY a JSON array:
[{{"index": 0, "value": "Stevin George"}}, {{"index": 1, "value": "steving2006@gmail.com"}}]"""
        }],
    )

    text = response.content[0].text if response.content[0].type == "text" else ""
    match = re.search(r"\[[\s\S]*\]", text)
    if not match:
        return []
    return json.loads(match.group())


def fill_field(page, selector, value, field_type):
    """Fill a single form field."""
    try:
        el = page.locator(selector).first
        if not el.is_visible(timeout=2000):
            return False

        if field_type == "select":
            try:
                el.select_option(label=value)
                return True
            except Exception:
                try:
                    el.select_option(value=value)
                    return True
                except Exception:
                    return False

        el.click()
        el.fill("")
        page.wait_for_timeout(200)
        el.fill(value)
        page.wait_for_timeout(200)
        el.evaluate("el => { el.dispatchEvent(new Event('change', {bubbles: true})); el.dispatchEvent(new Event('blur', {bubbles: true})); }")
        return True
    except Exception as e:
        print(f"  Failed to fill {selector}: {e}")
        return False


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 apply.py <job_url>")
        print('Example: python3 apply.py "https://nvidia.wd5.myworkdayjobs.com/..."')
        sys.exit(1)

    url = sys.argv[1]
    print(f"\n{'='*60}")
    print(f"AutoInternship Quick Apply")
    print(f"{'='*60}")
    print(f"URL: {url}\n")

    # Launch stealth browser
    print("[1/6] Launching stealth browser...")
    sb = sb_cdp.Chrome(locale="en")
    endpoint_url = sb.get_endpoint_url()

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(endpoint_url)
        page = browser.contexts[0].pages[0]

        # Navigate
        print(f"[2/6] Navigating to application page...")
        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_timeout(4000)

        # Handle CAPTCHA
        try:
            sb.solve_captcha()
        except Exception:
            pass

        page.wait_for_timeout(2000)

        # Extract fields
        print("[3/6] Scanning form fields...")
        fields = extract_fields(page)
        job_desc = extract_job_description(page)
        print(f"  Found {len(fields)} fields")

        if not fields:
            print("  No fields found, waiting longer...")
            page.wait_for_timeout(5000)
            fields = extract_fields(page)
            print(f"  Retry: found {len(fields)} fields")

        # Ask Claude
        if fields:
            print("[4/6] Asking Claude for field values...")
            answers = ask_claude(fields, job_desc, url)
            print(f"  Got {len(answers)} answers")

            # Fill fields
            print("[5/6] Filling form fields...")
            filled = 0
            for answer in answers:
                idx = answer.get("index", -1)
                value = answer.get("value", "")
                if idx < 0 or idx >= len(fields) or not value:
                    continue

                field = fields[idx]
                label = field["label"][:40]
                if fill_field(page, field["selector"], value, field["type"]):
                    print(f"  Filled: {label} = {value[:50]}")
                    filled += 1
                else:
                    print(f"  FAILED: {label}")
                page.wait_for_timeout(400)

            print(f"\n  Filled {filled}/{len(answers)} fields")
        else:
            print("[4/6] No fields to fill")

        # Upload resume
        print("[6/6] Uploading resume...")
        if os.path.exists(RESUME_PATH):
            try:
                file_input = page.locator('input[type="file"]').first
                if file_input.count() > 0:
                    file_input.set_input_files(RESUME_PATH)
                    page.wait_for_timeout(2000)
                    print("  Resume uploaded!")
                else:
                    print("  No file upload field found")
            except Exception as e:
                print(f"  Upload failed: {e}")
        else:
            print(f"  No resume.pdf found at {RESUME_PATH}")

        # Screenshot
        screenshot_path = os.path.join(os.path.dirname(__file__), "..", "screenshots", "quick-apply.png")
        os.makedirs(os.path.dirname(screenshot_path), exist_ok=True)
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"\n  Screenshot: {screenshot_path}")

        print(f"\n{'='*60}")
        print("DONE! Browser is still open.")
        print("Review the filled fields, then submit manually.")
        print("Press Enter here to close the browser.")
        print(f"{'='*60}\n")

        input()  # Wait for user to press Enter

    sb.driver.stop()


if __name__ == "__main__":
    main()
