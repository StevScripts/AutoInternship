const FIELDS = [
  "fullName", "email", "phone", "linkedin", "github", "portfolio",
  "university", "degree", "graduationDate", "gpa",
];

// Default profile — pre-filled on first load
const DEFAULT_PROFILE = {
  fullName: "Stevin George",
  email: "steving2006@gmail.com",
  phone: "407-257-0293",
  linkedin: "https://linkedin.com/in/georgestevin",
  github: "https://github.com/StevScripts",
  portfolio: "https://stevin.dev",
  university: "University of Central Florida",
  degree: "B.S. in Computer Science",
  graduationDate: "May 2028",
  gpa: "3.5",
  skills: [
    "Java", "Python", "SQL", "TypeScript", "JavaScript", "Lua", "C", "HTML", "CSS",
    "Spring Boot", "Flask", "Next.js", "React", "React Native", "Node.js", "Prisma", "Tailwind CSS",
    "AWS", "Docker", "CI/CD", "PostgreSQL", "Vercel", "Git",
    "OpenCV", "YOLOv8", "TensorFlow Lite", "Gemini API", "ElevenLabs", "ChromaDB",
    "N8N", "AI Automations"
  ],
};

// Load saved data on popup open, use defaults if first time
chrome.storage.local.get(["anthropicApiKey", "profile", "initialized"], (data) => {
  if (data.anthropicApiKey) {
    document.getElementById("apiKey").value = data.anthropicApiKey;
  }

  // Use saved profile, or defaults if never saved
  const profile = data.initialized ? (data.profile || {}) : DEFAULT_PROFILE;

  for (const field of FIELDS) {
    const el = document.getElementById(field);
    if (el && profile[field]) el.value = profile[field];
  }
  if (profile.skills) {
    document.getElementById("skills").value = profile.skills.join(", ");
  }

  // Auto-save defaults on first open
  if (!data.initialized) {
    chrome.storage.local.set({ profile: DEFAULT_PROFILE, initialized: true });
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
