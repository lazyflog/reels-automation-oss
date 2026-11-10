#!/usr/bin/env python3
"""Validate .env: report missing required and optional variables."""
import os
import sys

REQUIRED = [
    ("DATABASE_URL", "PostgreSQL connection URL"),
    ("REDIS_URL", "Redis connection URL"),
    ("OPENAI_API_KEY", "OpenAI API key (script generation)"),
    ("ELEVENLABS_API_KEY", "ElevenLabs API key (TTS)"),
]

OPTIONAL = [
    ("GEMINI_API_KEY", "Gemini API key (video analysis — skipped if unset)"),
    ("INSTAGRAM_ACCESS_TOKEN", "Instagram access token (Reels upload)"),
    ("INSTAGRAM_ACCOUNT_ID", "Instagram account ID (Reels upload)"),
    ("PUBLIC_BASE_URL", "Public HTTPS base URL Meta downloads videos from (Reels upload)"),
]


def _mask(val: str) -> str:
    return val[:8] + "..." if len(val) > 8 else "***"


def check() -> None:
    missing = []
    unset_optional = []

    print("=" * 60)
    print("Reels Automation — environment check")
    print("=" * 60)

    print("\n[Required]")
    for key, desc in REQUIRED:
        val = os.getenv(key, "")
        if not val:
            missing.append((key, desc))
            print(f"  ❌ {key}: {desc}")
        else:
            print(f"  ✅ {key}: {_mask(val)}")

    print("\n[Optional]")
    for key, desc in OPTIONAL:
        val = os.getenv(key, "")
        if not val:
            unset_optional.append((key, desc))
            print(f"  ⚠️  {key}: {desc} (not set)")
        else:
            print(f"  ✅ {key}: {_mask(val)}")

    print("\n" + "=" * 60)
    if missing:
        print(f"\n❌ {len(missing)} required variable(s) missing:")
        for key, desc in missing:
            print(f"   - {key}: {desc}")
        print("\nCreate a .env file from the example:")
        print("  cp .env.example .env")
        sys.exit(1)

    print("\n✅ All required variables are set.")
    if unset_optional:
        print(f"⚠️  {len(unset_optional)} optional variable(s) not set (related features are disabled).")
    sys.exit(0)


if __name__ == "__main__":
    from pathlib import Path

    env_file = Path(__file__).parent.parent / ".env"
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)
    else:
        print("⚠️  No .env file found — checking process environment only.")

    check()
