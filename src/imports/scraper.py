import re
import time
import requests
from config import HUNTER_API_KEY, HUNTER_CALL_DELAY_SEC, log, TEST_MODE, MAX_HUNTER_CALLS_PER_RUN

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_REGEX = re.compile(
    r"(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}"
)

_hunter_calls_used = 0


def extract_domain(website: str) -> str:
    website = website.replace("http://", "").replace("https://", "")
    return website.split("/")[0]


def scrape_contact_from_site(base_url: str) -> tuple[str | None, str | None]:
    log(f"Scanning {base_url}...", level="debug")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/123.0 Safari/537.36"
        )
    }

    visited = set()
    queue: list[str] = []

    if not base_url.startswith("http"):
        base_url = "https://" + base_url.lstrip("/")

    queue.append(base_url)

    priority_paths = ["/contact", "/contact-us", "/about", "/team", "/staff"]
    for p in priority_paths:
        queue.append(base_url.rstrip("/") + p)

    def fetch(url: str) -> str | None:
        try:
            res = requests.get(url, headers=headers, timeout=8)
            if res.status_code in (403, 429):
                return None
            res.raise_for_status()
            if "text/html" not in res.headers.get("Content-Type", ""):
                return None
            return res.text
        except Exception:
            return None

    def is_fake_email(e: str) -> bool:
        bad = ["wixpress", "sentry", "cloudflare", "example.com"]
        return any(b in e.lower() for b in bad)

    emails_found: list[str] = []
    phones_found: list[str] = []

    while queue and len(visited) < 10:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)

        html = fetch(url)
        if not html:
            continue

        emails = EMAIL_REGEX.findall(html)
        for e in emails:
            if not is_fake_email(e):
                emails_found.append(e)

        phones_found.extend(PHONE_REGEX.findall(html))

        for match in re.findall(r'href="([^"]+)"', html):
            if match.startswith("/") and len(queue) < 20:
                queue.append(base_url.rstrip("/") + match)

    if emails_found:
        log(f"Found email: {emails_found[0]}")
    if phones_found:
        log(f"Found phone: {phones_found[0]}", level="debug")

    return (emails_found[0] if emails_found else None, phones_found[0] if phones_found else None)


def scrape_email_from_site(base_url: str) -> str | None:
    email, _phone = scrape_contact_from_site(base_url)
    return email


def hunter_find_email(domain: str) -> str | None:
    global _hunter_calls_used

    if TEST_MODE:
        return None
    if not HUNTER_API_KEY:
        return None
    if _hunter_calls_used >= MAX_HUNTER_CALLS_PER_RUN:
        return None

    url = f"https://api.hunter.io/v2/domain-search?domain={domain}&api_key={HUNTER_API_KEY}"

    try:
        time.sleep(HUNTER_CALL_DELAY_SEC)
        res = requests.get(url, timeout=8)
        res.raise_for_status()
        data = res.json()
        emails = data.get("data", {}).get("emails", [])
        if not emails:
            return None
        email = emails[0].get("value")
        _hunter_calls_used += 1
        return email
    except Exception:
        return None
