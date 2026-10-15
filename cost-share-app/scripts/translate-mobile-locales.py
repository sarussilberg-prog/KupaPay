#!/usr/bin/env python3
"""
Generate mobile locale JSON from en.json (MyMemory API + on-disk cache).
Preserves {{interpolation}} tokens. Re-run safe — uses cache per target language.
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

from deep_translator import MyMemoryTranslator

ROOT = Path(__file__).resolve().parents[1]
LOCALES_DIR = ROOT / "apps/mobile/i18n/locales"
BASE = LOCALES_DIR / "en.json"
CACHE_DIR = ROOT / "scripts/.locale-translate-cache"

TARGETS = {
    "ru": ("en-US", "ru-RU"),
    "ar": ("en-US", "ar-SA"),
    "fr": ("en-US", "fr-FR"),
    "es": ("en-US", "es-ES"),
    "de": ("en-US", "de-DE"),
}

PLACEHOLDER_RE = re.compile(r"\{\{[^}]+\}\}")


def protect_placeholders(text: str) -> tuple[str, list[str]]:
    tokens: list[str] = []

    def repl(m: re.Match[str]) -> str:
        tokens.append(m.group(0))
        return f"__PH{len(tokens) - 1}__"

    return PLACEHOLDER_RE.sub(repl, text), tokens


def restore_placeholders(text: str, tokens: list[str]) -> str:
    for i, tok in enumerate(tokens):
        text = text.replace(f"__PH{i}__", tok)
    return text


def should_skip_translate(text: str) -> bool:
    if not text or not text.strip():
        return True
    if text.startswith("http://") or text.startswith("https://"):
        return True
    return False


def load_cache(lang: str) -> dict[str, str]:
    path = CACHE_DIR / f"{lang}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def save_cache(lang: str, cache: dict[str, str]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{lang}.json"
    path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def translate_string(text: str, source: str, target: str, cache: dict[str, str]) -> str:
    if text in cache:
        return cache[text]
    if should_skip_translate(text):
        cache[text] = text
        return text

    protected, tokens = protect_placeholders(text)
    last_err: Exception | None = None
    for attempt in range(6):
        try:
            out = MyMemoryTranslator(source=source, target=target).translate(protected)
            out = restore_placeholders(out, tokens)
            cache[text] = out
            time.sleep(1.2)
            return out
        except Exception as e:
            last_err = e
            wait = min(60, 2 ** attempt)
            print(f"  retry in {wait}s ({e!r}) for {text[:50]!r}", file=sys.stderr)
            time.sleep(wait)
    print(f"  giving up, keeping English: {text[:60]!r} ({last_err!r})", file=sys.stderr)
    cache[text] = text
    return text


def walk(obj, source: str, target: str, cache: dict[str, str]):
    if isinstance(obj, dict):
        return {k: walk(v, source, target, cache) for k, v in obj.items()}
    if isinstance(obj, list):
        return [walk(v, source, target, cache) for v in obj]
    if isinstance(obj, str):
        return translate_string(obj, source, target, cache)
    return obj


def translate_one(lang: str, source: str, target: str) -> None:
    base = json.loads(BASE.read_text(encoding="utf-8"))
    cache = load_cache(lang)
    print(f"[{lang}] cache hits {len(cache)}", flush=True)
    translated = walk(base, source, target, cache)
    save_cache(lang, cache)
    out_path = LOCALES_DIR / f"{lang}.json"
    out_path.write_text(
        json.dumps(translated, ensure_ascii=False, indent=4) + "\n",
        encoding="utf-8",
    )
    print(f"[{lang}] wrote {out_path}", flush=True)


def main() -> None:
    langs = sys.argv[1:] if len(sys.argv) > 1 else list(TARGETS.keys())
    for lang in langs:
        if lang not in TARGETS:
            print(f"Unknown language {lang}", file=sys.stderr)
            sys.exit(1)
        source, target = TARGETS[lang]
        translate_one(lang, source, target)


if __name__ == "__main__":
    main()
