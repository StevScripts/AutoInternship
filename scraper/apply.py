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
import random
import anthropic
from playwright.sync_api import sync_playwright
from seleniumbase import sb_cdp
from dotenv import load_dotenv


def human_delay(min_s=0.8, max_s=2.5):
    """Random delay to mimic human behavior."""
    time.sleep(random.uniform(min_s, max_s))


def human_typing_delay():
    """Shorter delay between field fills, like a person tabbing between fields."""
    time.sleep(random.uniform(0.3, 1.2))


def page_load_delay():
    """Longer delay after page navigation or button clicks."""
    time.sleep(random.uniform(2.5, 5.5))

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
RESUME_PATH = os.path.join(os.path.dirname(__file__), "..", "resume.pdf")

PROFILE = {
    "full_name": "Stevin George",
    "first_name": "Stevin",
    "last_name": "George",
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
    "address": "Orlando, FL",
    "country": "United States",
    "password": "Stevinismyname14!",
    "skills": "Java, Python, SQL, TypeScript, JavaScript, C, HTML, CSS, Spring Boot, Flask, Next.js, React, React Native, Node.js, Prisma, Tailwind CSS, AWS, Docker, CI/CD, PostgreSQL, Vercel, Git, OpenCV, YOLOv8, TensorFlow Lite, Gemini API, ElevenLabs, ChromaDB, N8N, AI Automations",
}

DEFAULT_PASSWORD = "Stevinismyname14!"


def extract_fields(page):
    """Extract visible form fields from the page, including inside iframes and modals."""

    # First check for iframes (many ATS platforms load forms in iframes)
    try:
        iframes = page.frames
        for frame in iframes:
            if frame == page.main_frame:
                continue
            frame_fields = _extract_fields_from_context(frame)
            if len(frame_fields) > 0:
                print(f"  Found {len(frame_fields)} fields inside iframe")
                return frame_fields
    except Exception:
        pass

    return _extract_fields_from_context(page)


def _extract_fields_from_context(ctx):
    """Extract form fields from a page or frame context."""
    return ctx.evaluate("""() => {
        const fields = [];
        const inputs = document.querySelectorAll(
            'input[type="text"], input[type="email"], input[type="tel"], ' +
            'input[type="url"], input[type="number"], input[type="password"], textarea, select'
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
        human_typing_delay()
        el.fill(value)
        human_typing_delay()
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

        # Get or create a page
        if browser.contexts and browser.contexts[0].pages:
            page = browser.contexts[0].pages[0]
        else:
            context = browser.new_context()
            page = context.new_page()

        # Navigate
        print(f"[2/6] Navigating to application page...")
        page.goto(url, wait_until="domcontentloaded")
        page_load_delay()

        # Handle cookie banner
        try:
            cookie_btn = page.locator('button:has-text("Accept Cookies"), button:has-text("Accept"), button:has-text("Decline")').first
            if cookie_btn.is_visible(timeout=2000):
                human_delay()
                cookie_btn.click()
                human_delay()
        except Exception:
            pass

        # Handle CAPTCHA
        try:
            sb.solve_captcha()
        except Exception:
            pass

        # Extract job description BEFORE clicking Apply (it's on this page)
        job_desc = extract_job_description(page)

        # Click "Apply" button if we're on a job listing page (not already on form)
        try:
            apply_btn = page.locator(
                'a:has-text("Apply Now"), button:has-text("Apply Now"), '
                'a:has-text("Apply"), button:has-text("Apply"), '
                'a:has-text("Quick Apply"), button:has-text("Quick Apply"), '
                'a:has-text("Easy Apply"), button:has-text("Easy Apply")'
            ).first
            if apply_btn.is_visible(timeout=3000):
                print("  Found Apply button, clicking...")
                human_delay(1.0, 3.0)
                apply_btn.click()
                page_load_delay()

                # Wait for modal/popup/new page to load
                page.wait_for_timeout(3000)

                # Check if a new tab/popup opened
                if len(browser.contexts[0].pages) > 1:
                    page = browser.contexts[0].pages[-1]  # Switch to newest tab
                    print("  Switched to new tab")
                    page_load_delay()

                # Workday sometimes asks "Sign In" or "Apply Manually"
                try:
                    manual_btn = page.locator(
                        'a:has-text("Apply Manually"), button:has-text("Apply Manually"), '
                        'a:has-text("Apply with your resume"), button:has-text("Apply with your resume"), '
                        'a:has-text("Upload Resume"), button:has-text("Upload Resume")'
                    ).first
                    if manual_btn.is_visible(timeout=3000):
                        human_delay()
                        manual_btn.click()
                        page_load_delay()
                except Exception:
                    pass
        except Exception:
            pass

        page_load_delay()

        # Workday multi-step handler
        step = 0
        max_steps = 8  # Safety limit

        while step < max_steps:
            step += 1
            current_url = page.url
            page_text = page.text_content("body")[:500] if page.locator("body").count() > 0 else ""

            print(f"\n--- Step {step} ---")

            # Take a step screenshot
            step_screenshot = os.path.join(os.path.dirname(__file__), "..", "screenshots", f"step-{step}.png")
            os.makedirs(os.path.dirname(step_screenshot), exist_ok=True)
            page.screenshot(path=step_screenshot)

            # Extract fields on current page
            fields = extract_fields(page)
            print(f"  Found {len(fields)} fields")

            if not fields:
                # Try scrolling down to trigger lazy-loaded forms
                page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
                page_load_delay()
                fields = extract_fields(page)
                print(f"  Retry after scroll: {len(fields)} fields")

            if not fields:
                # Check for "Apply" buttons we may have missed (modals, etc.)
                try:
                    apply_again = page.locator(
                        'button:has-text("Apply"), a:has-text("Apply"), '
                        'button:has-text("Start Application"), a:has-text("Start Application")'
                    ).first
                    if apply_again.is_visible(timeout=2000):
                        print("  Found another Apply button, clicking...")
                        human_delay()
                        apply_again.click()
                        page_load_delay()
                        fields = extract_fields(page)
                        print(f"  After second click: {len(fields)} fields")
                except Exception:
                    pass

            if not fields:
                # Check for sign-in/sign-up options (Eightfold, Workday, etc.)
                try:
                    email_signin = page.locator(
                        'button:has-text("Sign in with email"), a:has-text("Sign in with email"), '
                        'button:has-text("Sign up with email"), a:has-text("Sign up with email"), '
                        'button:has-text("Continue with email"), a:has-text("Continue with email"), '
                        'button:has-text("Create Account"), a:has-text("Create Account")'
                    ).first
                    if email_signin.is_visible(timeout=2000):
                        print(f"  Found '{email_signin.text_content().strip()}', clicking...")
                        human_delay()
                        email_signin.click()
                        page_load_delay()
                        fields = extract_fields(page)
                        print(f"  After sign-in click: {len(fields)} fields")
                except Exception:
                    pass

            if not fields:
                print("  No fields on this page. Checking for navigation...")
                # Check if there's a "Next" or "Continue" or "Save and Continue" button
                next_btn = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Save and Continue"), button:has-text("Submit")').first
                if next_btn.is_visible(timeout=2000):
                    btn_text = next_btn.text_content().strip()
                    if "submit" in btn_text.lower():
                        print(f"  Found Submit button. STOPPING — review and submit manually.")
                        break
                    print(f"  Clicking '{btn_text}'...")
                    human_delay(0.5, 1.5)
                    next_btn.click()
                    page_load_delay()
                    continue
                else:
                    print("  No fields and no navigation button. Done.")
                    break

            # Handle password fields directly (don't send to Claude)
            password_fields = [f for f in fields if f["type"] == "password"]
            regular_fields = [f for f in fields if f["type"] != "password"]

            for pf in password_fields:
                fill_field(page, pf["selector"], DEFAULT_PASSWORD, "password")
                human_typing_delay()
                print(f"  Filled password: {pf['label'][:30]}")

            # Ask Claude for remaining fields
            if regular_fields:
                print(f"  Asking Claude for {len(regular_fields)} fields...")
                answers = ask_claude(regular_fields, job_desc, url)
                print(f"  Got {len(answers)} answers")

                filled = 0
                for answer in answers:
                    idx = answer.get("index", -1)
                    value = answer.get("value", "")
                    if idx < 0 or not value:
                        continue

                    # Find the matching field
                    field = None
                    for f in regular_fields:
                        if f["index"] == idx:
                            field = f
                            break
                    if not field:
                        continue

                    label = field["label"][:40]
                    if fill_field(page, field["selector"], value, field["type"]):
                        print(f"  Filled: {label} = {value[:50]}")
                        filled += 1
                    else:
                        print(f"  FAILED: {label}")
                    human_typing_delay()

                print(f"  Filled {filled}/{len(answers)} fields this step")

            # Try to upload resume if there's a file input
            if os.path.exists(RESUME_PATH):
                try:
                    file_input = page.locator('input[type="file"]').first
                    if file_input.count() > 0:
                        file_input.set_input_files(RESUME_PATH)
                        page_load_delay()
                        print("  Resume uploaded!")
                except Exception:
                    pass

            # Look for "Next" / "Continue" / "Save and Continue" button to advance
            human_delay(1.0, 2.5)
            try:
                next_btn = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Save and Continue")').first
                if next_btn.is_visible(timeout=2000):
                    btn_text = next_btn.text_content().strip()
                    print(f"  Clicking '{btn_text}' to advance...")
                    human_delay(0.5, 1.5)
                    next_btn.click()
                    page_load_delay()
                    continue
            except Exception:
                pass

            # Check for Create Account button
            try:
                create_btn = page.locator('button:has-text("Create Account"), button:has-text("Sign Up")').first
                if create_btn.is_visible(timeout=2000):
                    print("  Clicking 'Create Account'...")
                    human_delay(1.0, 2.0)
                    create_btn.click()
                    time.sleep(random.uniform(6.0, 10.0))  # Account creation takes time
                    continue
            except Exception:
                pass

            # Check for Sign In button (if account already exists)
            try:
                signin_btn = page.locator('a:has-text("Sign In"), button:has-text("Sign In")').first
                if signin_btn.is_visible(timeout=2000):
                    print("  Account may already exist. Clicking 'Sign In'...")
                    human_delay()
                    signin_btn.click()
                    page_load_delay()

                    # Fill sign-in fields
                    sign_fields = extract_fields(page)
                    for sf in sign_fields:
                        if "email" in sf["label"].lower():
                            fill_field(page, sf["selector"], PROFILE["email"], sf["type"])
                        elif sf["type"] == "password":
                            fill_field(page, sf["selector"], DEFAULT_PASSWORD, sf["type"])

                    # Click sign in
                    try:
                        submit_signin = page.locator('button:has-text("Sign In"), button[type="submit"]').first
                        if submit_signin.is_visible(timeout=2000):
                            human_delay()
                            submit_signin.click()
                            page_load_delay()
                    except Exception:
                        pass
                    continue
            except Exception:
                pass

            # No next button found — we're either done or stuck
            print("  No next/continue button. Taking final screenshot.")
            break

        # Final screenshot
        final_screenshot = os.path.join(os.path.dirname(__file__), "..", "screenshots", "quick-apply-final.png")
        page.screenshot(path=final_screenshot, full_page=True)
        print(f"\n  Final screenshot: {final_screenshot}")

        print(f"\n{'='*60}")
        print("DONE! Browser is still open.")
        print("Review the filled fields, then submit manually.")
        print(f"{'='*60}\n")

        # Keep browser open indefinitely — user closes it manually
        print("Browser will stay open. Close it manually when done.")
        try:
            input("Or press Enter here to close...")
        except EOFError:
            # Running non-interactively — just leave it open, don't kill
            print("Browser left open. Close Chrome manually when done.")

    # Don't call sb.driver.stop() — leave the browser running


if __name__ == "__main__":
    main()
