import time
import msvcrt

from config import TEST_MODE, TEST_EMAIL, log
from db import load_db, save_db
from discovery import discover_new_leads
from outreach import run_outreach
from supabase_sync import sync_leads, sync_sent_emails


def check_pause():
    if msvcrt.kbhit():
        key = msvcrt.getch()
        if key == b' ':
            print("[PAUSED] Press SPACE to resume...")
            while True:
                if msvcrt.kbhit() and msvcrt.getch() == b' ':
                    print("[RESUMED]")
                    return
                time.sleep(0.1)


def main():
    log("=== VENDING MACHINE ENGINE START ===")
    if TEST_MODE:
        log(f"TEST_MODE active → sending to: {TEST_EMAIL}")

    db = load_db()
    log(f"Loaded DB: {len(db)} leads")

    db = discover_new_leads(db)
    db = run_outreach(db)

    save_db(db)
    sync_leads(db)
    sync_sent_emails()
    log("=== ENGINE FINISHED ===")


if __name__ == "__main__":
    main()
