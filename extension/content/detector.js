// Content script — detects job application forms and injects the AutoInternship overlay

(function () {
  "use strict";

  let overlayInjected = false;

  // Detect which ATS platform we're on
  function detectPlatform() {
    const url = window.location.href;
    if (url.includes("myworkdayjobs.com")) return "workday";
    if (url.includes("greenhouse.io")) return "greenhouse";
    if (url.includes("lever.co")) return "lever";
    if (url.includes("ashbyhq.com")) return "ashby";
    if (url.includes("joinhandshake.com")) return "handshake";
    if (url.includes("smartrecruiters.com")) return "smartrecruiters";
    if (url.includes("icims.com")) return "icims";
    return "unknown";
  }

  // Extract visible form fields from the page
  function extractFormFields() {
    const fields = [];
    const inputs = document.querySelectorAll(
      'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="number"], textarea, select'
    );

    inputs.forEach((el, i) => {
      // Skip hidden fields
      if (el.offsetParent === null && el.type !== "hidden") return;
      if (el.type === "hidden") return;

      // Find the label
      let label = "";
      const labelEl = el.closest("label") || document.querySelector(`label[for="${el.id}"]`);
      if (labelEl) {
        label = labelEl.textContent.trim();
      } else {
        // Try aria-label, placeholder, or nearby text
        label =
          el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          el.getAttribute("name") ||
          "";
      }

      // For Workday, look for data-automation-id labels
      if (!label) {
        const automationId = el.getAttribute("data-automation-id");
        if (automationId) label = automationId.replace(/([A-Z])/g, " $1").trim();
      }

      // Try parent element text
      if (!label) {
        const parent = el.closest("[class*='label'], [class*='field'], [class*='question']");
        if (parent) label = parent.textContent.trim().slice(0, 100);
      }

      let options = null;
      if (el.tagName === "SELECT") {
        options = Array.from(el.options).map((o) => o.textContent.trim()).join(", ");
      }

      fields.push({
        index: i,
        label: label.slice(0, 200),
        type: el.tagName === "SELECT" ? "select" : el.type || "text",
        options,
        currentValue: el.value || "",
        selector: generateSelector(el),
      });
    });

    return fields;
  }

  // Generate a reliable CSS selector for an element
  function generateSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.name) return `[name="${CSS.escape(el.name)}"]`;

    const path = [];
    let current = el;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector = `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }
      const siblings = current.parentElement
        ? Array.from(current.parentElement.children).filter((c) => c.tagName === current.tagName)
        : [];
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${idx})`;
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(" > ");
  }

  // Extract job description from the page
  function extractJobDescription() {
    // Try common selectors for job descriptions
    const selectors = [
      '[data-automation-id="jobPostingDescription"]',
      ".job-description",
      ".posting-description",
      ".job-details",
      '[class*="description"]',
      '[class*="posting"]',
      "article",
      "main",
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 100) {
        return el.textContent.trim().slice(0, 3000);
      }
    }

    return document.body.textContent.trim().slice(0, 3000);
  }

  // Fill a single form field with a value
  function fillField(selector, value, type) {
    const el = document.querySelector(selector);
    if (!el) return false;

    if (type === "select") {
      const option = Array.from(el.options).find(
        (o) => o.textContent.trim().toLowerCase() === value.toLowerCase() || o.value.toLowerCase() === value.toLowerCase()
      );
      if (option) {
        el.value = option.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      return false;
    }

    // For text inputs and textareas
    const nativeInputValueSetter =
      Object.getOwnPropertyDescriptor(
        el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
        "value"
      )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));

    return true;
  }

  // Create and inject the floating action button
  function injectOverlay() {
    if (overlayInjected) return;
    overlayInjected = true;

    const platform = detectPlatform();

    // Floating button
    const fab = document.createElement("div");
    fab.id = "autointernship-fab";
    fab.innerHTML = `
      <div id="ai-fab-btn" title="AutoInternship">AI</div>
      <div id="ai-fab-menu" style="display:none">
        <div id="ai-fab-status">Ready</div>
        <button id="ai-scan-btn">Scan Fields</button>
        <button id="ai-fill-btn" disabled>Fill All</button>
        <button id="ai-cover-btn">Generate Cover Letter</button>
        <div id="ai-fields-list"></div>
      </div>
    `;
    document.body.appendChild(fab);

    const fabBtn = document.getElementById("ai-fab-btn");
    const menu = document.getElementById("ai-fab-menu");
    const scanBtn = document.getElementById("ai-scan-btn");
    const fillBtn = document.getElementById("ai-fill-btn");
    const coverBtn = document.getElementById("ai-cover-btn");
    const statusEl = document.getElementById("ai-fab-status");
    const fieldsListEl = document.getElementById("ai-fields-list");

    let cachedAnswers = [];
    let cachedFields = [];

    fabBtn.addEventListener("click", () => {
      menu.style.display = menu.style.display === "none" ? "block" : "none";
    });

    // Scan fields and get AI answers
    scanBtn.addEventListener("click", async () => {
      statusEl.textContent = "Scanning fields...";
      scanBtn.disabled = true;

      cachedFields = extractFormFields();
      const jobDescription = extractJobDescription();

      statusEl.textContent = `Found ${cachedFields.length} fields. Asking Claude...`;

      chrome.runtime.sendMessage(
        {
          type: "GENERATE_ANSWERS",
          fields: cachedFields,
          jobDescription,
          pageUrl: window.location.href,
        },
        (response) => {
          scanBtn.disabled = false;

          if (!response || !response.success) {
            statusEl.textContent = `Error: ${response?.error || "Unknown error"}`;
            return;
          }

          cachedAnswers = response.answers;
          fillBtn.disabled = false;
          statusEl.textContent = `${cachedAnswers.length} fields ready to fill`;

          // Show preview
          fieldsListEl.innerHTML = cachedAnswers
            .map((a) => {
              const field = cachedFields[a.index];
              const source = a.source === "ai" ? "🤖" : "📋";
              const preview = a.value.length > 60 ? a.value.slice(0, 60) + "..." : a.value;
              return `<div class="ai-field-preview">
                <span class="ai-field-label">${source} ${field?.label || `Field ${a.index}`}</span>
                <span class="ai-field-value">${preview}</span>
              </div>`;
            })
            .join("");
        }
      );
    });

    // Fill all fields
    fillBtn.addEventListener("click", () => {
      let filled = 0;
      for (const answer of cachedAnswers) {
        const field = cachedFields[answer.index];
        if (field && fillField(field.selector, answer.value, field.type)) {
          filled++;
        }
      }
      statusEl.textContent = `Filled ${filled}/${cachedAnswers.length} fields`;
    });

    // Generate cover letter
    coverBtn.addEventListener("click", async () => {
      statusEl.textContent = "Generating cover letter...";
      coverBtn.disabled = true;

      const jobDescription = extractJobDescription();

      chrome.runtime.sendMessage(
        {
          type: "GENERATE_COVER_LETTER",
          jobDescription,
          pageUrl: window.location.href,
        },
        (response) => {
          coverBtn.disabled = false;

          if (!response || !response.success) {
            statusEl.textContent = `Error: ${response?.error || "Unknown error"}`;
            return;
          }

          // Copy to clipboard and show
          navigator.clipboard.writeText(response.coverLetter);
          statusEl.textContent = "Cover letter copied to clipboard!";

          fieldsListEl.innerHTML = `
            <div class="ai-cover-letter-preview">
              <div class="ai-field-label">Cover Letter (copied to clipboard)</div>
              <div class="ai-field-value">${response.coverLetter.replace(/\n/g, "<br>")}</div>
            </div>
          `;
        }
      );
    });
  }

  // Watch for page changes (SPAs like Workday)
  const observer = new MutationObserver(() => {
    // Check if we're on an application page
    const hasForm =
      document.querySelector("form") ||
      document.querySelector('[data-automation-id="applyButton"]') ||
      document.querySelector('input[type="text"]');

    if (hasForm && !overlayInjected) {
      injectOverlay();
    }
  });

  // Start observing
  observer.observe(document.body, { childList: true, subtree: true });

  // Also try immediately
  setTimeout(() => {
    if (!overlayInjected) injectOverlay();
  }, 2000);
})();
