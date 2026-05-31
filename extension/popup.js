const FIELDS = [
  "fullName", "email", "phone", "linkedin", "github", "portfolio",
  "university", "degree", "graduationDate", "gpa",
];

// Load saved data on popup open
chrome.storage.local.get(["anthropicApiKey", "profile"], (data) => {
  if (data.anthropicApiKey) {
    document.getElementById("apiKey").value = data.anthropicApiKey;
  }

  const profile = data.profile || {};
  for (const field of FIELDS) {
    const el = document.getElementById(field);
    if (el && profile[field]) el.value = profile[field];
  }
  if (profile.skills) {
    document.getElementById("skills").value = profile.skills.join(", ");
  }
});

// Save
document.getElementById("saveBtn").addEventListener("click", () => {
  const apiKey = document.getElementById("apiKey").value.trim();
  const profile = {};

  for (const field of FIELDS) {
    profile[field] = document.getElementById(field).value.trim();
  }

  const skillsRaw = document.getElementById("skills").value;
  profile.skills = skillsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  chrome.storage.local.set({ anthropicApiKey: apiKey, profile }, () => {
    document.getElementById("status").textContent = "Saved!";
    setTimeout(() => {
      document.getElementById("status").textContent = "";
    }, 2000);
  });
});
