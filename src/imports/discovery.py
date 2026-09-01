import time
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import (
    gmaps,
    LAT_LNG,
    SEARCH_RADIUS_METERS,
    TARGET_TYPES,
    CATEGORY_FILTERS,
    GOOGLE_CALL_DELAY_SEC,
    TEST_MODE,
    TEST_DISCOVERY_LIMIT,
    log,
)
from scraper import scrape_contact_from_site, hunter_find_email, extract_domain


def is_valid_business(name: str) -> bool:
    bad_keywords = [
        "city", "town", "village", "county", "school", "church",
        "police", "fire", "department", "government", "public",
        "park", "cemetery", "library", "museum", "army", "corps",
        "township", "community", "association"
    ]
    name_lower = name.lower()
    return not any(bad_word in name_lower for bad_word in bad_keywords)


def estimate_profit_score(name: str, website: str | None) -> int:
    name_lower = (name or "").lower()

    if any(x in name_lower for x in ["gym", "fitness", "apartment", "hotel", "inn", "urgent", "clinic"]):
        return 90
    if any(x in name_lower for x in ["auto", "repair", "tire", "battery"]):
        return 70
    if any(x in name_lower for x in ["school", "church", "club"]):
        return 60
    if any(x in name_lower for x in ["office", "insurance", "law", "real estate"]):
        return 40

    return 50


def is_duplicate(db: pd.DataFrame, name: str, website: str | None, email: str | None, place_id: str | None) -> bool:
    place_ids = set(db["place_id"].dropna().astype(str))
    names = set(db["name"].dropna().astype(str))
    websites = set(db["website"].dropna().astype(str))
    emails = set(db["email"].dropna().astype(str))

    if place_id and place_id in place_ids:
        return True
    if name and name in names:
        return True
    if website and website in websites:
        return True
    if email and email in emails:
        return True

    return False


def _matches_category(place_type: str, name: str, types: list[str]) -> bool:
    cfg = CATEGORY_FILTERS.get(place_type, {})
    name_keywords = [k.lower() for k in cfg.get("name_keywords", [])]
    required_types = cfg.get("required_types", [])
    name_lower = (name or "").lower()

    if required_types:
        if any(t in types for t in required_types):
            return True
    if name_keywords:
        if any(k in name_lower for k in name_keywords):
            return True

    return False


def discover_new_leads(db: pd.DataFrame) -> pd.DataFrame:
    log("Starting discovery...")
    seen_pids: set[str] = set()
    new_count = 0
    stop_discovery = False

    for place_type in TARGET_TYPES:
        if stop_discovery:
            break

        log(f"Searching: {place_type}")
        cfg = CATEGORY_FILTERS.get(place_type, {})
        keyword = cfg.get("keyword", place_type)

        try:
            time.sleep(GOOGLE_CALL_DELAY_SEC)
            places = gmaps.places_nearby(
                location=LAT_LNG,
                radius=SEARCH_RADIUS_METERS,
                keyword=keyword
            )
        except Exception as e:
            log(f"Google error: {e}")
            continue

        scrape_jobs: list[tuple[str, str, str, str | None, str | None]] = []
        no_website_jobs: list[tuple[str, str | None, str, str | None, str | None]] = []

        for p in places.get("results", []):
            name = p.get("name")
            pid = p.get("place_id")
            types = p.get("types", []) or []

            if not name or not pid:
                continue

            if pid in seen_pids:
                continue
            seen_pids.add(pid)

            if not _matches_category(place_type, name, types):
                log(f"Filtered out (category mismatch): {name}", level="debug")
                continue

            try:
                time.sleep(GOOGLE_CALL_DELAY_SEC)
                details = gmaps.place(
                    place_id=pid,
                    fields=[
                        "name",
                        "website",
                        "formatted_phone_number",
                        "international_phone_number",
                        "formatted_address",
                    ],
                ).get("result", {})
            except Exception:
                continue

            biz_name = details.get("name", name)
            website = details.get("website")
            phone = details.get("formatted_phone_number") or details.get("international_phone_number")
            address = details.get("formatted_address")

            if not is_valid_business(biz_name):
                log(f"Non-business skipped: {biz_name}", level="debug")
                continue

            if is_duplicate(db, biz_name, website, None, pid):
                log(f"Duplicate skipped: {biz_name}", level="debug")
                continue

            if website:
                scrape_jobs.append((biz_name, website, pid, phone, address))
            else:
                no_website_jobs.append((biz_name, None, pid, phone, address))

        # Add all no-website leads immediately
        for biz_name, website, pid, phone, address in no_website_jobs:
            db = pd.concat([db, pd.DataFrame([{
                "name": biz_name,
                "email": None,
                "status": "No Website",
                "last_contact": pd.NaT,
                "website": website,
                "phone": phone,
                "address": address,
                "notes": "",
                "profit_score": estimate_profit_score(biz_name, website),
                "place_id": pid,
            }])], ignore_index=True)

            new_count += 1
            log(f"Added: {biz_name} (no website)")

            if TEST_MODE and new_count >= TEST_DISCOVERY_LIMIT:
                log("TEST_MODE: stopping discovery after limited new leads.")
                stop_discovery = True
                break

        if stop_discovery:
            break

        # Scrape websites using threads
        if scrape_jobs:
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = {
                    executor.submit(scrape_contact_from_site, job[1]): job
                    for job in scrape_jobs
                }

                for future in as_completed(futures):
                    if stop_discovery:
                        executor.shutdown(cancel_futures=True)
                        break

                    biz_name, website, pid, phone, address = futures[future]

                    try:
                        found_email, scraped_phone = future.result(timeout=0.1)
                    except Exception:
                        found_email = None
                        scraped_phone = None

                    if not found_email and website:
                        found_email = hunter_find_email(extract_domain(website))

                    status = "New" if found_email else "No Email Found"

                    db = pd.concat([db, pd.DataFrame([{
                        "name": biz_name,
                        "email": found_email,
                        "status": status,
                        "last_contact": pd.NaT,
                        "website": website,
                        "phone": phone or scraped_phone,
                        "address": address,
                        "notes": "",
                        "profit_score": estimate_profit_score(biz_name, website),
                        "place_id": pid,
                    }])], ignore_index=True)

                    new_count += 1
                    if found_email:
                        log(f"Added: {biz_name} (email found)")
                    else:
                        log(f"Added: {biz_name} (no email)")

                    if TEST_MODE and new_count >= TEST_DISCOVERY_LIMIT:
                        log("TEST_MODE: stopping discovery after limited new leads.")
                        stop_discovery = True
                        executor.shutdown(cancel_futures=True)
                        break

    log(f"Discovery complete: {new_count} new leads")
    return db
