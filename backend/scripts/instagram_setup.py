"""Token/account setup tool for Instagram Login (Business Login).

To publish Reels via graph.instagram.com without a Facebook Page, this handles:
(1) short-lived → long-lived token exchange (2) IG account ID lookup (3) long-lived token refresh.

Prerequisites:
  1) Switch the Instagram account to "Professional → Business"
  2) Add the 'Instagram' product to your Meta app → API setup with Instagram login
  3) Scopes: instagram_business_basic, instagram_business_content_publish
  4) Pass the "short-lived token" obtained via Instagram Business Login to `exchange` below

Examples:
  # 1. Exchange a short-lived token for a long-lived token (60 days)  (requires APP_SECRET)
  python scripts/instagram_setup.py exchange --short <SHORT_TOKEN> --secret <APP_SECRET>

  # 2. Look up the IG account ID with the long-lived token → INSTAGRAM_ACCOUNT_ID value
  python scripts/instagram_setup.py me --token <LONG_TOKEN>

  # 3. Refresh the long-lived token before it expires (24h-60 days) → new 60-day token
  python scripts/instagram_setup.py refresh --token <LONG_TOKEN>
"""
import argparse
import sys

import requests

GRAPH = "https://graph.instagram.com"


def exchange(short_token: str, app_secret: str) -> None:
    """Exchange a short-lived token for a long-lived token (60 days)."""
    resp = requests.get(
        f"{GRAPH}/access_token",
        params={
            "grant_type": "ig_exchange_token",
            "client_secret": app_secret,
            "access_token": short_token,
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    expires_days = round(data.get("expires_in", 0) / 86400, 1)
    print("\n[Long-lived token issued]")
    print(f"INSTAGRAM_ACCESS_TOKEN={data['access_token']}")
    print(f"(Expires in ~{expires_days} days — refresh before it expires)\n")


def me(token: str) -> None:
    """Look up the IG account ID/username with a long-lived token."""
    resp = requests.get(
        f"{GRAPH}/me",
        params={"fields": "user_id,username", "access_token": token},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    # user_id is the INSTAGRAM_ACCOUNT_ID. Some responses return it in the id field.
    account_id = data.get("user_id") or data.get("id")
    print("\n[Account]")
    print(f"username=@{data.get('username')}")
    print(f"INSTAGRAM_ACCOUNT_ID={account_id}\n")


def refresh(token: str) -> None:
    """Refresh a long-lived token (only possible between 24h and 60 days old; resets to 60 days)."""
    resp = requests.get(
        f"{GRAPH}/refresh_access_token",
        params={"grant_type": "ig_refresh_token", "access_token": token},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    expires_days = round(data.get("expires_in", 0) / 86400, 1)
    print("\n[Token refreshed]")
    print(f"INSTAGRAM_ACCESS_TOKEN={data['access_token']}")
    print(f"(Expires in ~{expires_days} days)\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Instagram Login token/account setup")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_ex = sub.add_parser("exchange", help="Exchange a short-lived token for a long-lived token")
    p_ex.add_argument("--short", required=True, help="Short-lived token from Instagram Business Login")
    p_ex.add_argument("--secret", help="Instagram app secret (defaults to INSTAGRAM_APP_SECRET from .env)")

    p_me = sub.add_parser("me", help="Look up the IG account ID")
    p_me.add_argument("--token", required=True, help="Long-lived token")

    p_rf = sub.add_parser("refresh", help="Refresh a long-lived token")
    p_rf.add_argument("--token", required=True, help="Long-lived token to refresh")

    args = parser.parse_args()

    try:
        if args.cmd == "exchange":
            secret = args.secret
            if not secret:
                from config import settings
                secret = settings.instagram_app_secret
            if not secret:
                sys.exit("App secret is required (--secret or INSTAGRAM_APP_SECRET).")
            exchange(args.short, secret)
        elif args.cmd == "me":
            me(args.token)
        elif args.cmd == "refresh":
            refresh(args.token)
    except requests.HTTPError as e:
        sys.exit(f"API error: {e.response.status_code} {e.response.text}")


if __name__ == "__main__":
    main()
