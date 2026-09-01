import pandas as pd
from config import DB_PATH, SENT_EMAILS_PATH, log

COLUMNS = {
    "name": "string",
    "email": "string",
    "status": "string",
    "last_contact": "datetime64[ns]",
    "website": "string",
    "phone": "string",
    "address": "string",
    "city": "string",
    "state": "string",
    "notes": "string",
    "profit_score": "Int64",
    "place_id": "string",
    "business_type": "string",
}

def load_db() -> pd.DataFrame:
    if DB_PATH.exists():
        db = pd.read_csv(DB_PATH)

        # Ensure all required columns exist
        for col, dtype in COLUMNS.items():
            if col not in db.columns:
                db[col] = pd.NA
            db[col] = db[col].astype(dtype, errors="ignore")

        # Fix datetime column
        db["last_contact"] = pd.to_datetime(db["last_contact"], errors="coerce")

    else:
        # Create an empty DataFrame with correct schema
        db = pd.DataFrame({col: pd.Series(dtype=dtype) for col, dtype in COLUMNS.items()})

    return db


def save_db(db: pd.DataFrame) -> None:
    # Ensure correct column order and existence
    for col, dtype in COLUMNS.items():
        if col not in db.columns:
            db[col] = pd.NA
        db[col] = db[col].astype(dtype, errors="ignore")

    db = db[list(COLUMNS.keys())]
    db.to_csv(DB_PATH, index=False, encoding="utf-8")
    log(f"Database saved to {DB_PATH.name} with {len(db)} rows.")


def load_sent_emails() -> set[str]:
    if not SENT_EMAILS_PATH.exists():
        return set()
    try:
        df = pd.read_csv(SENT_EMAILS_PATH)
        if "email" not in df.columns:
            return set()
        return set(e.strip().lower() for e in df["email"].dropna().astype(str))
    except Exception:
        return set()


def save_sent_emails(sent_emails: set[str]) -> None:
    df = pd.DataFrame(sorted(sent_emails), columns=["email"])
    df.to_csv(SENT_EMAILS_PATH, index=False, encoding="utf-8")
    log(f"Saved {len(sent_emails)} sent emails to {SENT_EMAILS_PATH.name}.")
