"""Instagram Login(Business Login) 방식 토큰/계정 셋업 도구.

페이스북 페이지 없이 graph.instagram.com 경로로 릴스를 발행하기 위한
① 단기→장기 토큰 교환 ② IG 계정 ID 조회 ③ 장기 토큰 갱신 을 처리한다.

사전 준비:
  1) 인스타 계정을 "프로페셔널 → 비즈니스"로 전환
  2) Meta 앱에 'Instagram' 제품 추가 → API setup with Instagram login
  3) 스코프: instagram_business_basic, instagram_business_content_publish
  4) Instagram Business Login으로 받은 "단기 토큰"을 아래 exchange에 입력

사용 예:
  # 1. 단기 토큰 → 장기 토큰(60일)으로 교환  (APP_SECRET 필요)
  python scripts/instagram_setup.py exchange --short <SHORT_TOKEN> --secret <APP_SECRET>

  # 2. 장기 토큰으로 IG 계정 ID 확인 → INSTAGRAM_ACCOUNT_ID 값
  python scripts/instagram_setup.py me --token <LONG_TOKEN>

  # 3. 만료 전(24h~60일) 장기 토큰 갱신 → 새 60일 토큰
  python scripts/instagram_setup.py refresh --token <LONG_TOKEN>
"""
import argparse
import sys

import requests

GRAPH = "https://graph.instagram.com"


def exchange(short_token: str, app_secret: str) -> None:
    """단기 토큰 → 장기 토큰(60일) 교환."""
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
    print("\n[장기 토큰 발급 완료]")
    print(f"INSTAGRAM_ACCESS_TOKEN={data['access_token']}")
    print(f"(만료: 약 {expires_days}일 — 만료 전 refresh 필요)\n")


def me(token: str) -> None:
    """장기 토큰으로 IG 계정 ID/유저네임 조회."""
    resp = requests.get(
        f"{GRAPH}/me",
        params={"fields": "user_id,username", "access_token": token},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    # user_id가 곧 INSTAGRAM_ACCOUNT_ID. 일부 응답은 id 필드로 옴.
    account_id = data.get("user_id") or data.get("id")
    print("\n[계정 확인]")
    print(f"username=@{data.get('username')}")
    print(f"INSTAGRAM_ACCOUNT_ID={account_id}\n")


def refresh(token: str) -> None:
    """장기 토큰 갱신 (24h~60일 사이에서만 가능, 갱신 시 다시 60일)."""
    resp = requests.get(
        f"{GRAPH}/refresh_access_token",
        params={"grant_type": "ig_refresh_token", "access_token": token},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    expires_days = round(data.get("expires_in", 0) / 86400, 1)
    print("\n[토큰 갱신 완료]")
    print(f"INSTAGRAM_ACCESS_TOKEN={data['access_token']}")
    print(f"(만료: 약 {expires_days}일)\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Instagram Login 토큰/계정 셋업")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_ex = sub.add_parser("exchange", help="단기→장기 토큰 교환")
    p_ex.add_argument("--short", required=True, help="Instagram Business Login 단기 토큰")
    p_ex.add_argument("--secret", help="Instagram 앱 시크릿 (미지정 시 .env의 INSTAGRAM_APP_SECRET)")

    p_me = sub.add_parser("me", help="IG 계정 ID 조회")
    p_me.add_argument("--token", required=True, help="장기 토큰")

    p_rf = sub.add_parser("refresh", help="장기 토큰 갱신")
    p_rf.add_argument("--token", required=True, help="갱신할 장기 토큰")

    args = parser.parse_args()

    try:
        if args.cmd == "exchange":
            secret = args.secret
            if not secret:
                from config import settings
                secret = settings.instagram_app_secret
            if not secret:
                sys.exit("앱 시크릿이 필요합니다 (--secret 또는 INSTAGRAM_APP_SECRET).")
            exchange(args.short, secret)
        elif args.cmd == "me":
            me(args.token)
        elif args.cmd == "refresh":
            refresh(args.token)
    except requests.HTTPError as e:
        sys.exit(f"API 오류: {e.response.status_code} {e.response.text}")


if __name__ == "__main__":
    main()
