#!/usr/bin/env python3
"""Generate Play Store feature graphic (1024×500) and phone marketing frames (1080×1920)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPHICS = ROOT / "graphics"
MOBILE = ROOT.parents[1] / "cost-share-app" / "apps" / "mobile"
LOGO = MOBILE / "assets" / "brand" / "logo-master.png"


def ensure_pillow():
    try:
        import PIL  # noqa: F401
        return
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])


def main() -> None:
    ensure_pillow()
    from PIL import Image, ImageDraw, ImageFont

    GRAPHICS.mkdir(parents=True, exist_ok=True)
    phone_dir = GRAPHICS / "phone"
    phone_dir.mkdir(exist_ok=True)

    brand_blue = (59, 130, 246)
    white = (255, 255, 255)

    # Feature graphic 1024×500
    fg = Image.new("RGB", (1024, 500), brand_blue)
    draw = ImageDraw.Draw(fg)
    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 56)
        sub_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
    except OSError:
        title_font = ImageFont.load_default()
        sub_font = title_font

    if LOGO.exists():
        logo = Image.open(LOGO).convert("RGBA")
        logo.thumbnail((220, 220), Image.Resampling.LANCZOS)
        fg.paste(logo, (72, 140), logo)

    draw.text((320, 160), "KupaPay", fill=white, font=title_font)
    draw.text((320, 240), "Split group expenses — Hebrew RTL, Bit & PayBox", fill=white, font=sub_font)
    fg.save(GRAPHICS / "feature-graphic-1024x500.png")

    slides = [
        ("01-home", "Balances at a glance"),
        ("02-expense", "Add & split expenses"),
        ("03-settle", "Settle with Bit / PayBox"),
        ("04-pro", "KupaPay Pro — no ads"),
    ]

    for slug, caption in slides:
        frame = Image.new("RGB", (1080, 1920), (248, 250, 252))
        d = ImageDraw.Draw(frame)
        d.rounded_rectangle((60, 120, 1020, 1680), radius=48, fill=white, outline=(226, 232, 240), width=4)
        if LOGO.exists():
            mark = Image.open(LOGO).convert("RGBA")
            mark.thumbnail((180, 180), Image.Resampling.LANCZOS)
            frame.paste(mark, (450, 720), mark)
        d.text((540, 980), caption, fill=(17, 24, 39), anchor="mm", font=sub_font)
        d.text((540, 1780), "KupaPay — store/play marketing frame (replace with Maestro captures)", fill=(100, 116, 139), anchor="mm", font=sub_font)
        frame.save(phone_dir / f"{slug}.png")

    print(f"Wrote {GRAPHICS / 'feature-graphic-1024x500.png'} and {len(slides)} phone frames under {phone_dir}")


if __name__ == "__main__":
    main()
