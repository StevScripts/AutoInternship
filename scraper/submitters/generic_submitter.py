"""Application submitter using SeleniumBase CDP + Stealthy Playwright.

Navigates to a job application URL, detects the ATS platform,
fills form fields using AI-generated autofill data, uploads resume,
and takes a screenshot as proof. Does NOT click submit — waits for
manual confirmation or a second approval step.

Supports: Workday, Greenhouse, Lever, Ashby, Handshake, generic forms.
"""

import os
import time
import json
import anthropic
from playwright.sync_api import sync_playwright, Page
from seleniumbase import sb_cdp
from config import ANTHROPIC_API_KEY, RESUME_PDF_PATH, SCREENSHOTS_DIR


def detect_platform(url: str) -> str:
    """Detect ATS platform from URL."""
    if "myworkdayjobs.com" in url:
        return "workday"
    if "greenhouse.io" in url or "boards.greenhouse" in url:
        return "greenhouse"
    if "lever.co" in url:
        return "lever"
    if "ashbyhq.com" in url:
        return "ashby"
    if "joinhandshake.com" in url:
        return "handshake"
    if "smartrecruiters.com" in url:
        return "smartrecruiters"
    if "icims.com" in url:
        return "icims"
    return "generic"


def extract_form_fields(page: Page) -> list[dict]:
    """Extract all visible form fields from the page."""
    fields = page.evaluate("""() => {
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
                const parent = el.closest('[class*="label"], [class*="field"], [class*="question"]');
                if (parent) label = parent.textContent.trim().substring(0, 150);
            }

            let options = null;
            if (el.tagName === 'SELECT') {
                options = Array.from(el.options).map(o => o.textContent.trim()).join(', ');
            }

            // Build a selector
            let selector = '';
            if (el.id) selector = '#' + CSS.escape(el.id);
            else if (el.name) selector = '[name="' + el.name + '"]';
            else selector = el.tagName.toLowerCase() + ':nth-of-type(' + (Array.from(el.parentElement.children).filter(c => c.tagName === el.tagName).indexOf(el) + 1) + ')';

            fields.push({
                index: i,
                label: label.substring(0, 200),
                type: el.tagName === 'SELECT' ? 'select' : (el.type || 'text'),
                options: options,
                currentValue: el.value || '',
                selector: selector,
                tagName: el.tagName
            });
        });

        return fields;
    }""")
    return fields


def extract_job_description(page: Page) -> str:
    """Extract job description from the page."""
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


def ask_claude_for_field_values(fields: list[dict], autofill_data: dict, job_description: str, job_url: str) -> list[dict]:
    """Use Claude to figure out what to fill in each field."""
    if not ANTHROPIC_API_KEY:
        print("[Submitter] No Anthropic API key, using autofill_data directly")
        return []

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    profile_text = "\n".join(f"  {k}: {v}" for k, v in autofill_data.items())
    fields_text = "\n".join(
        f'[{f["index"]}] Label: "{f["label"]}" | Type: {f["type"]} | Options: {f["options"] or "none"} | Current: "{f["currentValue"]}"'
        for f in fields
    )

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system="""You fill out job application forms. Match form field labels to the candidate's data.

RULES:
- For name/email/phone/LinkedIn/GitHub fields: use exact profile values
- For work authorization: "Yes" or "Authorized to work in the US"
- For sponsorship: "No"
- For graduation/degree fields: use profile values
- For open-ended questions: write 2-3 specific sentences. Sound like a real student, not AI.
- For select dropdowns: pick the best matching option from the available choices
- Skip fields that are already filled correctly
- Skip file upload fields
- NEVER use words: leverage, utilize, passionate, innovative, dynamic, driven""",
        messages=[{
            "role": "user",
            "content": f"""Fill these form fields for a job application.

PROFILE DATA:
{profile_text}

JOB URL: {job_url}
JOB DESCRIPTION (excerpt):
{job_description[:1500]}

FORM FIELDS:
{fields_text}

Return ONLY a JSON array:
[{{"index": 0, "value": "Stevin George"}}, {{"index": 1, "value": "steving2006@gmail.com"}}]

Only include fields you can fill. Skip already-filled and file upload fields."""
        }],
    )

    text = response.content[0].text if response.content[0].type == "text" else ""
    json_match = __import__("re").search(r"\[[\s\S]*\]", text)
    if not json_match:
        return []
    return json.loads(json_match.group())


def fill_field(page: Page, selector: str, value: str, field_type: str) -> bool:
    """Fill a single form field with proper event dispatching."""
    try:
        el = page.locator(selector).first
        if not el.is_visible(timeout=2000):
            return False

        if field_type == "select":
            # Try selecting by label text
            try:
                el.select_option(label=value)
                return True
            except Exception:
                try:
                    el.select_option(value=value)
                    return True
                except Exception:
                    return False

        # For text inputs and textareas — clear then type
        el.click()
        el.fill("")
        page.wait_for_timeout(200)
        el.fill(value)
        page.wait_for_timeout(300)
        el.evaluate("el => { el.dispatchEvent(new Event('change', {bubbles: true})); el.dispatchEvent(new Event('blur', {bubbles: true})); }")
        return True

    except Exception as e:
        print(f"[Submitter] Failed to fill {selector}: {e}")
        return False


def upload_resume(page: Page) -> bool:
    """Find and fill the resume upload field."""
    if not os.path.exists(RESUME_PDF_PATH):
        print(f"[Submitter] Resume PDF not found at {RESUME_PDF_PATH}")
        return False

    try:
        file_input = page.locator('input[type="file"]').first
        if file_input.count() > 0:
            file_input.set_input_files(RESUME_PDF_PATH)
            page.wait_for_timeout(2000)
            print("[Submitter] Resume uploaded")
            return True
    except Exception as e:
        print(f"[Submitter] Resume upload failed: {e}")

    return False


def submit_application(application_data: dict) -> dict:
    """Fill out a job application using SeleniumBase stealth + Playwright.

    Does NOT click the final submit button. Takes a screenshot for review.
    The watcher will mark it as submitted after this succeeds.
    """
    application = application_data.get("application", {})
    job = application_data.get("job", {})
    application_id = application_data.get("application_id", application.get("id", "unknown"))

    apply_url = job.get("applyUrl") or job.get("apply_url") or job.get("jobUrl") or job.get("job_url")
    if not apply_url:
        print("[Submitter] No apply URL found")
        return {"status": "error", "error": "no_apply_url"}

    autofill_data = application.get("autofillData") or application.get("autofill_data") or {}
    platform = detect_platform(apply_url)
    print(f"[Submitter] Platform: {platform} | URL: {apply_url}")

    try:
        # Launch stealth browser
        sb = sb_cdp.Chrome(locale="en")
        endpoint_url = sb.get_endpoint_url()

        with sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(endpoint_url)
            page = browser.contexts[0].pages[0]

            # Navigate to application page
            print(f"[Submitter] Navigating to {apply_url}")
            page.goto(apply_url, wait_until="domcontentloaded")
            page.wait_for_timeout(4000)

            # Handle any CAPTCHA
            try:
                sb.solve_captcha()
            except Exception:
                pass

            page.wait_for_timeout(2000)

            # Extract form fields and job description
            fields = extract_form_fields(page)
            job_description = extract_job_description(page)
            print(f"[Submitter] Found {len(fields)} form fields")

            if not fields:
                print("[Submitter] No form fields found. Page might need more loading.")
                page.wait_for_timeout(5000)
                fields = extract_form_fields(page)
                print(f"[Submitter] Retry: found {len(fields)} fields")

            # Get AI-generated values for fields
            if fields:
                answers = ask_claude_for_field_values(fields, autofill_data, job_description, apply_url)
                print(f"[Submitter] Claude provided {len(answers)} field answers")

                # Fill fields
                filled = 0
                for answer in answers:
                    idx = answer.get("index", -1)
                    value = answer.get("value", "")
                    if idx < 0 or idx >= len(fields) or not value:
                        continue

                    field = fields[idx]
                    if fill_field(page, field["selector"], value, field["type"]):
                        filled += 1
                        page.wait_for_timeout(300)  # Human-like delay between fields

                print(f"[Submitter] Filled {filled}/{len(answers)} fields")

            # Try to upload resume
            upload_resume(page)

            # Take screenshot as proof
            screenshot_path = os.path.join(SCREENSHOTS_DIR, f"{application_id}.png")
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"[Submitter] Screenshot saved: {screenshot_path}")

            # DO NOT click submit — the application is now pre-filled
            # The user reviews in the PWA and the watcher marks it as submitted
            page.wait_for_timeout(2000)

        sb.driver.stop()

        return {
            "status": "filled",
            "fields_filled": filled if fields else 0,
            "screenshot": screenshot_path,
            "platform": platform,
        }

    except Exception as e:
        print(f"[Submitter] Error: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}
