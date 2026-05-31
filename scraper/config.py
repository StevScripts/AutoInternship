import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DATABASE_URL = os.environ["DATABASE_URL"]
API_URL = os.environ.get("AUTOINTERNSHIP_API_URL", "http://localhost:3000")
API_KEY = os.environ["AUTOINTERNSHIP_API_KEY"]
SERPER_API_KEY = os.environ.get("SERPER_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# Resume PDF path (compiled from LaTeX)
RESUME_PDF_PATH = os.path.join(os.path.dirname(__file__), "..", "resume.pdf")

# Screenshot output directory
SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), "..", "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

# Search configuration
SEARCH_TERMS = [
    "software engineering intern",
    "software engineer intern",
    "AI intern",
    "machine learning intern",
    "frontend developer intern",
    "backend developer intern",
    "full stack intern",
    "DevOps intern",
]

LOCATIONS = ["United States"]

# How many hours back to look for new postings
HOURS_OLD = 72

# Rate limiting delays (seconds)
DELAY_BETWEEN_SOURCES = 2
DELAY_BETWEEN_REQUESTS = 1

# Workday companies to check (tenant, data center number, site)
WORKDAY_COMPANIES = [
    ("google", 5, "Google"),
    ("amazon", 5, "AmazonJobs"),
    ("meta", 1, "Meta"),
    ("apple", 1, "apple"),
    ("microsoft", 1, "Microsoft"),
    ("netflix", 5, "NetflixExternal"),
    ("nvidia", 5, "NVIDIAExternalCareerSite"),
    ("salesforce", 1, "External"),
    ("adobe", 1, "AdobeExternalSite"),
    ("uber", 1, "Uber"),
]
