import time
import smtplib
import pandas as pd
from email.mime.text import MIMEText
from datetime import datetime, timedelta

from config import (
    SMTP_EMAIL,
    SMTP_APP_PASSWORD,
    PHONE_NUMBER,
    TEST_MODE,
    TEST_EMAIL,
    EMAIL_SEND_DELAY_SEC,
    TEST_EMAIL_LIMIT,
    log,
)
from db import load_sent_emails, save_sent_emails
from replyScanner import check_for_reply
from supabase_sync import get_already_emailed_recipients, sync_email_history


def send_email(to_email: str, subject: str, body: str) -> bool:
    log(f"Sending email to: {to_email}")

    if not SMTP_EMAIL or not SMTP_APP_PASSWORD:
        log("SMTP credentials missing")
        return False

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["To"] = to_email
    msg["From"] = SMTP_EMAIL

    try:
        time.sleep(EMAIL_SEND_DELAY_SEC)
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
            s.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
            s.send_message(msg)
        log("Email sent.")
        return True
    except Exception as e:
        log(f"Email failed: {e}")
        return False


def build_pitch(biz_name: str, is_followup: bool = False):
    phone_line = f"\nCall/Text: {PHONE_NUMBER}\n" if PHONE_NUMBER else ""

    if not is_followup:
        subject = "Free modern vending machine upgrade for your business"
        body = (
            f"Hi {biz_name} Team,\n\n"
            "I run a small vending service that installs and maintains modern smart vending machines "
            "at NO COST to your business.\n\n"
            "We handle installation, restocking, repairs, and maintenance.\n\n"
            "If you already have vending machines, we can replace them with newer, more reliable smart machines.\n\n"
            "Would you be open to a quick conversation?\n\n"
            "Best,\nEvan" + phone_line
        )
    else:
        subject = "Quick follow-up about upgrading your vending machines"
        body = (
            f"Hi {biz_name} Team,\n\n"
            "Just following up on my previous message about placing a modern vending machine at your location.\n\n"
            "We handle installation, restocking, repairs, and maintenance.\n\n"
            "If you're open to it, I'd love to schedule a quick call.\n\n"
            "Best,\nEvan" + phone_line
        )

    return subject, body


def run_outreach(db: pd.DataFrame) -> pd.DataFrame:
    now = datetime.now()
    emails_sent = 0

    sent_emails = load_sent_emails()
    local_sent: set[str] = set()

    # Pull ALL recipients this user has ever emailed from Supabase email_history.
    # This is the master dedup set — it prevents sending to someone who was
    # already contacted in a previous run or from the web dashboard.
    supabase_emailed: set[str] = set()
    try:
        supabase_emailed = get_already_emailed_recipients()
        if supabase_emailed:
            log(f"Loaded {len(supabase_emailed)} previously-emailed recipients from Supabase email_history.")
    except Exception as e:
        log(f"Could not load Supabase email history for dedup: {e}")

    # Collect records to batch-sync to email_history after the run
    email_history_batch: list[dict] = []

    for idx, lead in db.iterrows():
        if TEST_MODE and emails_sent >= TEST_EMAIL_LIMIT:
            log("TEST_MODE: stopping outreach after limited emails.")
            break

        email = lead.get("email")
        name = lead.get("name", "there")
        status = lead.get("status", "")
        last_contact = lead.get("last_contact")

        if pd.isna(email):
            continue

        email_norm = str(email).strip().lower()

        # ── MASTER DEDUP: local CSV + Supabase email_history ──
        if not TEST_MODE:
            if email_norm in sent_emails or email_norm in local_sent:
                log(f"Skipping {email} (already contacted — local CSV).")
                continue
            if email_norm in supabase_emailed:
                log(f"Skipping {email} (already contacted — Supabase email_history).")
                continue

        target_email = TEST_EMAIL if TEST_MODE else email

        if status == "New":
            subject, body = build_pitch(name, False)
            if send_email(target_email, subject, body):
                emails_sent += 1
                db.at[idx, "status"] = "Contacted_Once"
                db.at[idx, "last_contact"] = now
                if not TEST_MODE:
                    local_sent.add(email_norm)
                    email_history_batch.append({
                        "recipient": email_norm,
                        "email_type": "outreach_initial",
                        "subject": subject,
                        "body_preview": body[:500],
                        "is_followup": False,
                    })
            continue

        if status == "Contacted_Once":
            if check_for_reply(email, last_contact):
                db.at[idx, "status"] = "Replied"
                continue

            if last_contact is not pd.NaT and now - last_contact > timedelta(hours=48):
                subject, body = build_pitch(name, True)
                if send_email(target_email, subject, body):
                    emails_sent += 1
                    db.at[idx, "status"] = "Full_Contact"
                    db.at[idx, "last_contact"] = now
                    if not TEST_MODE:
                        local_sent.add(email_norm)
                        email_history_batch.append({
                            "recipient": email_norm,
                            "email_type": "outreach_followup",
                            "subject": subject,
                            "body_preview": body[:500],
                            "is_followup": True,
                        })
            continue

        if status == "Full_Contact":
            if check_for_reply(email, last_contact):
                db.at[idx, "status"] = "Replied"
                continue

            if last_contact is not pd.NaT and now - last_contact > timedelta(hours=96):
                db.at[idx, "status"] = "No_Contact"
            continue

    if not TEST_MODE and local_sent:
        sent_emails.update(local_sent)
        save_sent_emails(sent_emails)

    # Batch-sync all emails sent this run to Supabase email_history
    if not TEST_MODE and email_history_batch:
        try:
            sync_email_history(email_history_batch)
            log(f"Batch-synced {len(email_history_batch)} records to Supabase email_history.")
        except Exception as e:
            log(f"Failed to sync email_history batch: {e}")

    return db
