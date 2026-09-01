import imaplib
import email
from email.header import decode_header
import datetime
import os

IMAP_EMAIL = os.getenv("IMAP_EMAIL")
IMAP_PASSWORD = os.getenv("IMAP_PASSWORD")
IMAP_SERVER = os.getenv("IMAP_SERVER", "imap.gmail.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", 993))


def connect_imap():
    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(IMAP_EMAIL, IMAP_PASSWORD)
        return mail
    except Exception as e:
        print(f"[IMAP ERROR] Could not connect: {e}")
        return None


def check_for_reply(lead_email, since_datetime):
    """
    Returns True if a reply from lead_email was found after since_datetime.
    """

    mail = connect_imap()
    if not mail:
        return False

    try:
        mail.select("INBOX")

        # Convert datetime to IMAP search format
        since_str = since_datetime.strftime("%d-%b-%Y")

        # Search for emails FROM the lead
        status, messages = mail.search(
            None,
            f'(FROM "{lead_email}" SINCE {since_str})'
        )

        if status != "OK":
            return False

        msg_ids = messages[0].split()
        if not msg_ids:
            return False

        # If ANY message exists, treat it as a reply
        return True

    except Exception as e:
        print(f"[IMAP ERROR] {e}")
        return False

    finally:
        try:
            mail.close()
            mail.logout()
        except:
            pass
