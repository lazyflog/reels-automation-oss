"""Font registry for subtitles and cover titles.

Built-in fonts come from Debian packages installed in the Docker image
(all SIL Open Font License 1.1):
  - fonts-nanum / fonts-nanum-extra  (Korean)
  - fonts-noto-cjk                   (Chinese / Japanese / Korean)

Any additional .ttf / .otf / .ttc files you put in ``backend/fonts/`` are copied
to ``CUSTOM_FONT_DIR`` at build time and listed automatically. Make sure the
font's license allows the way you use it (see docs/ASSETS.md).
"""
import os

CUSTOM_FONT_DIR = "/usr/share/fonts/truetype/custom"
_NANUM = "/usr/share/fonts/truetype/nanum"
_NOTO_CJK = "/usr/share/fonts/opentype/noto"

_FONT_EXTENSIONS = {".ttf", ".otf", ".ttc"}

# Built-in fonts: display name → path inside the container
BUILTIN_FONTS: dict[str, str] = {
    "Nanum Gothic Bold (default)":     f"{_NANUM}/NanumGothicBold.ttf",
    "Nanum Gothic":                    f"{_NANUM}/NanumGothic.ttf",
    "Nanum Barun Gothic":              f"{_NANUM}/NanumBarunGothic.ttf",
    "Nanum Barun Gothic Bold":         f"{_NANUM}/NanumBarunGothicBold.ttf",
    "Nanum Myeongjo":                  f"{_NANUM}/NanumMyeongjo.ttf",
    "Nanum Myeongjo Bold":             f"{_NANUM}/NanumMyeongjoBold.ttf",
    "Nanum Square ExtraBold":          f"{_NANUM}/NanumSquareEB.ttf",
    "Nanum Square Bold":               f"{_NANUM}/NanumSquareB.ttf",
    "Nanum Square":                    f"{_NANUM}/NanumSquareR.ttf",
    "Nanum Square Light":              f"{_NANUM}/NanumSquareL.ttf",
    "Nanum Square Round ExtraBold":    f"{_NANUM}/NanumSquareRoundEB.ttf",
    "Nanum Square Round Bold":         f"{_NANUM}/NanumSquareRoundB.ttf",
    "Nanum Square Round":              f"{_NANUM}/NanumSquareRoundR.ttf",
    "Nanum Square Round Light":        f"{_NANUM}/NanumSquareRoundL.ttf",
    "Noto Sans CJK Bold":              f"{_NOTO_CJK}/NotoSansCJK-Bold.ttc",
    "Noto Sans CJK Regular":           f"{_NOTO_CJK}/NotoSansCJK-Regular.ttc",
}

# Font families: family name → { regular, bold } (used by the bold toggle)
FONT_FAMILIES: dict[str, dict[str, str]] = {
    "Nanum Gothic": {
        "regular": f"{_NANUM}/NanumGothic.ttf",
        "bold":    f"{_NANUM}/NanumGothicBold.ttf",
    },
    "Nanum Barun Gothic": {
        "regular": f"{_NANUM}/NanumBarunGothic.ttf",
        "bold":    f"{_NANUM}/NanumBarunGothicBold.ttf",
    },
    "Nanum Myeongjo": {
        "regular": f"{_NANUM}/NanumMyeongjo.ttf",
        "bold":    f"{_NANUM}/NanumMyeongjoBold.ttf",
    },
    "Nanum Square": {
        "regular": f"{_NANUM}/NanumSquareR.ttf",
        "bold":    f"{_NANUM}/NanumSquareB.ttf",
    },
    "Nanum Square Round": {
        "regular": f"{_NANUM}/NanumSquareRoundR.ttf",
        "bold":    f"{_NANUM}/NanumSquareRoundB.ttf",
    },
    "Noto Sans CJK": {
        "regular": f"{_NOTO_CJK}/NotoSansCJK-Regular.ttc",
        "bold":    f"{_NOTO_CJK}/NotoSansCJK-Bold.ttc",
    },
}

DEFAULT_FONT = BUILTIN_FONTS["Nanum Gothic Bold (default)"]


def _custom_fonts() -> dict[str, str]:
    """Scan CUSTOM_FONT_DIR for user-supplied fonts (display name = file name)."""
    if not os.path.isdir(CUSTOM_FONT_DIR):
        return {}
    fonts = {}
    for name in sorted(os.listdir(CUSTOM_FONT_DIR)):
        stem, ext = os.path.splitext(name)
        if ext.lower() in _FONT_EXTENSIONS:
            fonts[stem] = os.path.join(CUSTOM_FONT_DIR, name)
    return fonts


def _all_fonts() -> dict[str, str]:
    fonts = {k: v for k, v in BUILTIN_FONTS.items() if os.path.exists(v)}
    fonts.update(_custom_fonts())
    return fonts


def list_fonts() -> list[dict]:
    return [{"name": k, "path": v} for k, v in _all_fonts().items()]


def list_font_families() -> list[dict]:
    """Families whose regular/bold files are both installed."""
    return [
        {"name": name, "regular": paths["regular"], "bold": paths["bold"]}
        for name, paths in FONT_FAMILIES.items()
        if os.path.exists(paths["regular"]) and os.path.exists(paths["bold"])
    ]


def resolve_font(path: str | None) -> str:
    """Return ``path`` if it is a registered font, else the default font.

    Only paths from the registry are accepted (prevents path injection).
    """
    if path and os.path.exists(path):
        valid = set(_all_fonts().values()) | {
            p for fam in FONT_FAMILIES.values() for p in fam.values()
        }
        if path in valid:
            return path
    return DEFAULT_FONT
