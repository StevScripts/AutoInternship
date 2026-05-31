# SeleniumBase Undetectable Automation Reference

Source: Michael Mintz — "Undetectable Automation: 5th Edition" (2026)
Video: https://www.youtube.com/watch?v=R9HNsnbYh8o
Docs: https://seleniumbase.io/

## Overview

SeleniumBase is a Python framework for browser automation that passes every bot detection test. It has three stealth modes, each progressively stealthier:

1. **UC Mode** — Modified chromedriver that disconnects/reconnects at strategic times
2. **CDP Mode** — Uses Chrome DevTools Protocol directly (stealthier than WebDriver)
3. **Stealthy Playwright Mode** — Playwright connects to a stealth CDP session

## Why SeleniumBase Over NoDriver/Patchright

- Passes ALL bot detection tests (Cloudflare, Kasada, DataDome, PerimeterX, Akamai, Imperva)
- Built-in CAPTCHA solving (`sb.solve_captcha()`)
- Can use both Selenium and Playwright APIs together
- Active maintenance (10+ years, sole maintainer Michael Mintz)
- Three modes to choose from depending on needs
- PyAutoGUI integration for GUI-level interactions

## Installation

```bash
pip install seleniumbase playwright
```

No need for `playwright install` when using system Chrome.

---

## Mode 1: UC Mode (Undetectable Chromedriver)

How it evades detection:
1. Renames `cdc_` Chrome DevTools Console variables that sites scan for
2. Launches Chrome independently, then attaches chromedriver (avoids bot-specific init patterns)
3. Disconnects chromedriver during sensitive actions (CAPTCHA clicks, form submissions)

### Basic Usage

```python
from seleniumbase import SB

with SB(uc=True, test=True, locale="en") as sb:
    url = "https://example.com"
    sb.uc_open_with_reconnect(url, 4)  # open + disconnect for 4 seconds
    sb.uc_gui_click_captcha()          # solve CAPTCHA via PyAutoGUI
```

### Key Methods

```python
sb.uc_open(url)                              # Open with stealth
sb.uc_open_with_reconnect(url, time)         # Open, disconnect, reconnect
sb.uc_open_with_disconnect(url, timeout)     # Open and stay disconnected
sb.uc_click(selector, reconnect_time=None)   # Click while disconnected
sb.uc_gui_click_captcha()                    # Auto-detect and solve CAPTCHA
sb.disconnect()                              # Manual disconnect
sb.reconnect(timeout)                        # Manual reconnect
```

---

## Mode 2: CDP Mode (Chrome DevTools Protocol)

Stealthier than UC Mode because it talks directly via CDP, not WebDriver.

### Basic Usage

```python
from seleniumbase import SB

with SB(uc=True, test=True, locale="en") as sb:
    sb.activate_cdp_mode("https://example.com")
    sb.sleep(1.5)
    sb.cdp.click("button.submit")
    sb.cdp.type("input#email", "test@example.com")
```

### Pure CDP Mode (No WebDriver at all)

```python
from seleniumbase import sb_cdp

sb = sb_cdp.Chrome()
sb.open("https://example.com")
sb.click("button")
sb.type("input", "text")
sb.driver.stop()
```

### Key CDP Methods

**Navigation:**
```python
sb.cdp.get(url)
sb.cdp.reload()
sb.cdp.go_back()
sb.cdp.get_current_url()
```

**Interaction:**
```python
sb.cdp.click(selector)
sb.cdp.type(selector, text)
sb.cdp.press_keys(selector, text)
sb.cdp.select_option_by_text(dropdown, option)
sb.cdp.gui_click_element(selector)  # PyAutoGUI fallback
```

**Data Extraction:**
```python
sb.cdp.get_text(selector)
sb.cdp.get_html()
sb.cdp.get_page_source()
sb.cdp.find_element(selector)
sb.cdp.find_all(selector)
sb.cdp.select_all(selector)
sb.cdp.find_element_by_text(text)
```

**Cookies/Storage:**
```python
sb.cdp.get_all_cookies()
sb.cdp.set_all_cookies(cookies)
sb.cdp.get_local_storage_item(key)
```

**CAPTCHA:**
```python
sb.solve_captcha()
sb.click_captcha()
```

**File Upload:**
```python
element.send_file("/path/to/resume.pdf")
```

---

## Mode 3: Stealthy Playwright Mode

Playwright connects to a stealth SeleniumBase browser session via `connect_over_cdp()`.

### Why Use This

- Full Playwright API (better for complex form filling, SPA navigation)
- Stealth provided by SeleniumBase's CDP session
- Can use both SeleniumBase and Playwright methods together

### Sync Format (Simplest)

```python
from playwright.sync_api import sync_playwright
from seleniumbase import sb_cdp

sb = sb_cdp.Chrome()
endpoint_url = sb.get_endpoint_url()

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp(endpoint_url)
    page = browser.contexts[0].pages[0]
    page.goto("https://example.com")
    page.fill("input#name", "Stevin George")
    page.click("button[type='submit']")
```

### Async Format (Best Performance)

```python
import asyncio
from seleniumbase import cdp_driver
from playwright.async_api import async_playwright

async def main():
    driver = await cdp_driver.start_async()
    endpoint_url = driver.get_endpoint_url()
    
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(endpoint_url)
        page = browser.contexts[0].pages[0]
        await page.goto("https://example.com")

asyncio.run(main())
```

### With Proxy

```python
sb = sb_cdp.Chrome(use_chromium=True, proxy="user:pass@server:port")
sb.open(url)
endpoint_url = sb.get_endpoint_url()
```

---

## Real-World Anti-Bot Examples

### Walmart (Akamai + PerimeterX)
```python
with SB(uc=True, test=True, ad_block=True) as sb:
    sb.activate_cdp_mode("https://www.walmart.com/")
    if sb.is_element_visible("#px-captcha"):
        sb.gui_click_and_hold("#px-captcha", 7.2)
        sb.sleep(4.2)
```

### Cloudflare-Protected Sites
```python
with SB(uc=True, test=True, locale="en") as sb:
    sb.uc_open_with_reconnect(url, 4)
    sb.uc_gui_click_captcha()
```

### Sites with DataDome
```python
sb.activate_cdp_mode(url)
sb.cdp.press_keys("input#search", search_term)
results = sb.cdp.select_all(".result-card")
for card in results:
    title = card.query_selector(".title")
    print(title.text)
```

---

## Best Practices for Stealth

1. **Add realistic delays** — 1-5 seconds between actions. Too fast = flagged as bot.
2. **Use `ad_block=True`** — blocks trackers that might detect automation.
3. **Use `locale="en"`** — consistent browser locale prevents fingerprint mismatches.
4. **Disconnect during sensitive actions** — CAPTCHA solving, login, form submission.
5. **Use PyAutoGUI for tough CAPTCHAs** — `sb.gui_click_and_hold()` for PerimeterX.
6. **Don't run headless** — headless mode is detectable. Use `xvfb=True` on Linux instead.
7. **Use `guest=True`** for clean sessions without profile data leaking.
8. **Vary viewport sizes** — don't use default 1920x1080 every time.

---

## For AutoInternship: Recommended Approach

Replace NoDriver with SeleniumBase CDP Mode + Stealthy Playwright:

```python
from playwright.sync_api import sync_playwright
from seleniumbase import sb_cdp

sb = sb_cdp.Chrome(locale="en")
endpoint_url = sb.get_endpoint_url()

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp(endpoint_url)
    page = browser.contexts[0].pages[0]
    
    # Navigate to job application
    page.goto("https://company.wd5.myworkdayjobs.com/...")
    
    # Fill application form
    page.fill("input[data-automation-id='name']", "Stevin George")
    page.fill("input[data-automation-id='email']", "steving2006@gmail.com")
    
    # Upload resume
    page.set_input_files("input[type='file']", "/path/to/resume.pdf")
    
    # Handle CAPTCHA if present
    sb.solve_captcha()
    
    # Submit
    page.click("button[data-automation-id='submit']")
```

This gives us:
- Playwright's superior form-filling API
- SeleniumBase's undetectable browser session
- Built-in CAPTCHA solving
- Works on Workday, Greenhouse, Lever, Handshake, etc.
