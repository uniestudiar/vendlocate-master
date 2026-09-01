import pandas as pd
import requests
from datetime import datetime, timezone

from config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_USER_ID,
    SUPABASE_PURCHASE_ID,
    log,
)
from db import load_sent_emails


def _enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and SUPABASE_USER_ID)


def _headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY or "",
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }


def _latest_purchase_id() -> str | None:
    if SUPABASE_PURCHASE_ID:
        return SUPABASE_PURCHASE_ID

    if not _enabled():
        return None

    url = (
        f"{SUPABASE_URL.rstrip('/')}/rest/v1/purchases"
        f"?user_id=eq.{SUPABASE_USER_ID}&status=eq.active&select=id&order=purchase_date.desc&limit=1"
    )
    res = requests.get(url, headers=_headers(), timeout=20)
    res.raise_for_status()
    purchases = res.json()
    if not purchases:
        return None
    return purchases[0].get("id")


def _get_user_primary_location_id() -> str | None:
    """Fetch the user's primary (locked) location ID from Supabase so leads
    can be associated with it for dashboard filtering."""
    if not _enabled():
        return None

    url = (
        f"{SUPABASE_URL.rstrip('/')}/rest/v1/user_locations"
        f"?user_id=eq.{SUPABASE_USER_ID}&is_primary=eq.true&select=id&limit=1"
    )
    try:
        res = requests.get(url, headers=_headers(), timeout=10)
        res.raise_for_status()
        rows = res.json()
        if rows:
            return rows[0].get("id")
    except Exception as e:
        log(f"Could not fetch primary location ID: {e}", level="debug")
    return None


def sync_leads(db: pd.DataFrame) -> None:
    purchase_id = _latest_purchase_id()
    location_id = _get_user_primary_location_id()

    if not _enabled() or not purchase_id:
        log("Supabase lead sync skipped; missing Supabase env values.", level="debug")
        return

    rows = []
    for _, lead in db.iterrows():
        row = {
            "purchase_id": purchase_id,
            "user_id": SUPABASE_USER_ID,
            "business_name": lead.get("name") or "Unknown Business",
            "business_type": lead.get("business_type") or "General",
            "phone": None if pd.isna(lead.get("phone")) else lead.get("phone"),
            "email": None if pd.isna(lead.get("email")) else lead.get("email"),
            "website": None if pd.isna(lead.get("website")) else lead.get("website"),
            "has_website": not pd.isna(lead.get("website")),
            "place_id": None if pd.isna(lead.get("place_id")) else lead.get("place_id"),
            "profit_score": None if pd.isna(lead.get("profit_score")) else int(lead.get("profit_score")),
            "ranking": None if pd.isna(lead.get("profit_score")) else int(lead.get("profit_score")),
            "status": lead.get("status") or "new",
            "notes": None if pd.isna(lead.get("notes")) else lead.get("notes"),
            "city": None if pd.isna(lead.get("city")) else lead.get("city"),
            "state": None if pd.isna(lead.get("state")) else lead.get("state"),
            "address": None if pd.isna(lead.get("address")) else lead.get("address"),
        }
        # Associate lead with the user's primary location for dashboard filtering
        if location_id:
            row["user_location_id"] = location_id
        rows.append(row)

    if not rows:
        return

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/leads?on_conflict=place_id"
    res = requests.post(url, headers=_headers(), json=rows, timeout=20)
    res.raise_for_status()
    log(f"Synced {len(rows)} leads to Supabase (location_id={location_id}).")


def sync_sent_emails() -> None:
    """Sync the local sent_emails CSV to the Supabase sent_emails table."""
    if not _enabled():
        log("Supabase sent email sync skipped; missing Supabase env values.", level="debug")
        return

    sent_emails = load_sent_emails()
    if not sent_emails:
        return

    rows = [
        {
            "user_id": SUPABASE_USER_ID,
            "email_address": email,
            "email_type": "initial",
        }
        for email in sent_emails
    ]

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/sent_emails?on_conflict=user_id,email_address,email_type"
    res = requests.post(url, headers=_headers(), json=rows, timeout=20)
    res.raise_for_status()
    log(f"Synced {len(rows)} sent email records to Supabase.")


def sync_email_history(sent_records: list[dict]) -> None:
    """Sync email sending records to the email_history table (single source
    of truth). Each record should contain at minimum:
        recipient, email_type, subject, body_preview, related_lead_id
    The unique index on (user_id, recipient, email_type, subject) prevents
    duplicates at the DB level.
    """
    if not _enabled():
        log("Supabase email_history sync skipped; missing env values.", level="debug")
        return

    if not sent_records:
        return

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for rec in sent_records:
        rows.append({
            "user_id": SUPABASE_USER_ID,
            "recipient": str(rec.get("recipient", "")).strip().lower(),
            "email_type": rec.get("email_type", "outreach_initial"),
            "subject": rec.get("subject", ""),
            "body_preview": rec.get("body_preview", None),
            "status": "sent",
            "related_lead_id": rec.get("related_lead_id", None),
            "is_followup": rec.get("is_followup", False),
            "sent_at": now,
        })

    if not rows:
        return

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/email_history"
    try:
        res = requests.post(url, headers=_headers(), json=rows, timeout=20)
        # 23505 = unique_violation — treat as success (dedup working)
        if res.status_code == 409 or (res.status_code == 200 and "23505" in str(res.text)):
            log(f"Email history dedup triggered — {len(rows)} records already exist.")
        else:
            res.raise_for_status()
            log(f"Synced {len(rows)} email history records to Supabase.")
    except requests.exceptions.HTTPError as e:
        if "23505" in str(e):
            log(f"Email history dedup (23505) — already recorded.")
        else:
            log(f"Email history sync error: {e}")


def get_already_emailed_recipients() -> set[str]:
    """Query Supabase email_history for all recipients this user has already
    contacted (any email_type). Returns a set of lowercased email addresses.
    Used by outreach.py to prevent sending duplicates across runs."""
    if not _enabled():
        return set()

    url = (
        f"{SUPABASE_URL.rstrip('/')}/rest/v1/email_history"
        f"?user_id=eq.{SUPABASE_USER_ID}&select=recipient"
        f"&limit=10000"
    )
    try:
        res = requests.get(url, headers=_headers(), timeout=20)
        res.raise_for_status()
        rows = res.json()
        return {r["recipient"].strip().lower() for r in rows if r.get("recipient")}
    except Exception as e:
        log(f"Could not fetch email history for dedup: {e}", level="debug")
        return set()
