import os
import googlemaps
from pathlib import Path
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# =========================
# ENV / CONFIG
# =========================

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
HUNTER_API_KEY = os.getenv("HUNTER_API_KEY")
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD")
PHONE_NUMBER = os.getenv("PHONE_NUMBER", "")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_USER_ID = os.getenv("SUPABASE_USER_ID")
SUPABASE_PURCHASE_ID = os.getenv("SUPABASE_PURCHASE_ID")

TEST_MODE = os.getenv("TEST_MODE", "true").lower() == "true"
TEST_EMAIL = os.getenv("TEST_EMAIL")

LOG_LEVEL = os.getenv("LOG_LEVEL", "info")  # "info" or "debug"

TEST_DISCOVERY_LIMIT = int(os.getenv("TEST_DISCOVERY_LIMIT", "5"))
TEST_EMAIL_LIMIT = int(os.getenv("TEST_EMAIL_LIMIT", "1"))

LAT_LNG = (41.5915060718549, -90.41758881951003)
SEARCH_RADIUS_METERS = 22000  # ~13.6 miles ≈ 20 min drive

TARGET_TYPES = [
    "laundromat",
    "car_repair",
    "hospital",
    "veterinary_care",
    "doctor",
    "apartment_complex",
    "lodging",
    "senior_center",
    "gym",
]

CATEGORY_FILTERS = {
    "laundromat": {
        "keyword": "laundromat",
        "name_keywords": ["laundry", "laundromat", "coin", "cleaner"],
        "required_types": ["laundry"],
    },
    "car_repair": {
        "keyword": "auto repair",
        "name_keywords": ["auto", "repair", "garage", "tire", "muffler", "mechanic", "service center"],
        "required_types": ["car_repair"],
    },
    "hospital": {
        "keyword": "hospital",
        "name_keywords": ["hospital", "medical center", "health center", "clinic", "urgent care", "er", "emergency"],
        "required_types": ["hospital", "health"],
    },
    "veterinary_care": {
        "keyword": "veterinary",
        "name_keywords": ["vet", "veterinary", "animal hospital", "pet clinic"],
        "required_types": ["veterinary_care"],
    },
    "doctor": {
        "keyword": "doctor",
        "name_keywords": ["doctor", "dr.", "md", "clinic", "family medicine", "internal medicine"],
        "required_types": ["doctor", "health"],
    },
    "apartment_complex": {
        "keyword": "apartments",
        "name_keywords": ["apartments", "apartment", "complex", "flats", "residences", "housing"],
        "required_types": ["apartment_complex"],
    },
    "lodging": {
        "keyword": "hotel",
        "name_keywords": ["hotel", "inn", "suites", "lodge", "motel", "resort"],
        "required_types": ["lodging"],
    },
    "senior_center": {
        "keyword": "senior living",
        "name_keywords": ["senior", "retirement", "assisted living", "nursing home", "elder care"],
        "required_types": ["senior_center"],
    },
    "gym": {
        "keyword": "gym",
        "name_keywords": ["gym", "fitness", "training", "crossfit", "athletics", "performance"],
        "required_types": ["gym"],
    },
}

MAX_HUNTER_CALLS_PER_RUN = 10
GOOGLE_CALL_DELAY_SEC = 0.05
HUNTER_CALL_DELAY_SEC = 1.0
EMAIL_SEND_DELAY_SEC = 2.0

DB_PATH = Path("vending_leads.csv")
SENT_EMAILS_PATH = Path("sent_emails.csv")

gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)


def log(msg: str, level: str = "info") -> None:
    if LOG_LEVEL == "debug":
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")
        return

    if level == "info":
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")
