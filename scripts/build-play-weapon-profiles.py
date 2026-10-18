#!/usr/bin/env python3
"""Build concise factual weapon profiles from the site's structured source data.

Only profile values and special-rule labels are retained. Descriptions and full
rules prose are deliberately excluded. Cached pages live outside the repository.
"""
from __future__ import annotations

import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import time
import unicodedata
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "dist/data"
SOURCE = "https://tow.whfb.app/"
CACHE = Path("/tmp/old-world-play-weapon-profiles")


def normal(value):
    value = unicodedata.normalize("NFKC", str(value)).replace("’", "'")
    value = re.sub(r"\s*\{[^}]*\}\s*", " ", value)
    value = re.sub(r"\s*\([^)]*\)\s*", " ", value)
    value = re.sub(r"\*+$", "", value.strip())
    return re.sub(r"\s+", " ", value).strip().lower()


def visible_text(value):
    """Read rich text without following its linked rule/association records."""
    if isinstance(value, list):
        return "".join(visible_text(x) for x in value)
    if not isinstance(value, dict):
        return ""
    if value.get("nodeType") == "text":
        return value.get("value", "")
    result = visible_text(value.get("content", []))
    if value.get("nodeType") in ("paragraph", "list-item"):
        result += "\n"
    return result


def get_fields(path):
    cache = CACHE / (hashlib.sha256(path.encode()).hexdigest() + ".json")
    if cache.exists():
        return json.loads(cache.read_text())
    for attempt in range(3):
        try:
            request = urllib.request.Request(SOURCE + path + "?minimal=true", headers={"User-Agent": "Mozilla/5.0"})
            html = urllib.request.urlopen(request, timeout=35).read().decode()
            data = json.loads(re.search(r'<script id="__NEXT_DATA__" type="application/json">([\s\S]*?)</script>', html)[1])
            fields = data["props"]["pageProps"]["entry"]["fields"]
            cache.write_text(json.dumps(fields, ensure_ascii=False))
            return fields
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def embedded_profiles(value):
    if not isinstance(value, dict):
        return
    if "range" in value and "strength" in value:
        yield value
    target = value.get("data", {}).get("target", {})
    if isinstance(target, dict):
        fields = target.get("fields", {})
        if "range" in fields and "strength" in fields:
            yield fields
    for child in value.get("content", []):
        yield from embedded_profiles(child)


COMMON_NOTES = {
    "lance": "Cavalry/monster only; charge turn only; Strength and AP modifiers apply against enemies charged this turn.",
    "cavalry spear": "Cavalry/monster/chariot only; Strength and AP modifiers on charge turn only; no supporting attacks on charge turn.",
    "morning star": "Strength modifier and Armour Bane (1) apply against enemies charged this turn.",
    "throwing spear": "Combat weapon; charge turn only; otherwise use hand weapon.",
    "flail": "Strength modifier and Armour Bane (1) apply against enemies charged this turn.",
    "halberd": "Requires two hands.",
    "great weapon": "Requires two hands; Strike Last.",
}


def concise_conditions(fields):
    """Summarise explicit mechanical conditions without retaining rules prose."""
    text = re.sub(r"\s+", " ", fields.get("bodyIndex", ""))
    notes = []
    if re.search(r"can only be used during a turn in which the wielder charged", text, re.I):
        notes.append("Charge turn only; otherwise use hand weapon.")
    elif re.search(r"Strength and Armour Piercing modifiers apply only during a turn in which the wielder charged", text, re.I):
        notes.append("Strength and AP modifiers on charge turn only.")
    elif re.search(r"Strength modifier and Armour Bane \(1\).*?apply only against enemy models the wielder charged", text, re.I):
        notes.append("Strength modifier and Armour Bane (1) apply against enemies charged this turn.")
    elif re.search(r"Strength modifier applies only against enemy models the wielder charged", text, re.I):
        notes.append("Strength modifier applies against enemies charged this turn.")
    if re.search(r"single use|once per game", text, re.I):
        notes.append("Once per game.")
    if "If used double-handed, the wielder may make only one attack" in text:
        notes.append("Double-handed profile: one attack only.")
    if "Strength characteristic of the Primeval Club is equal to the current Leadership" in text:
        notes.append("Weapon Strength equals the wielder's current Leadership.")
    return " ".join(notes)


def extract(path, aliases, page):
    fields = get_fields(path)
    profiles = list(embedded_profiles(fields)) + list(embedded_profiles(fields.get("body", {})))
    # A root profile is returned once; embedded profiles must not be duplicated.
    distinct = []
    seen = set()
    for profile in profiles:
        name = re.sub(r"\s*(?:\(Profile\)|Profile)\s*$", "", profile.get("name", fields.get("name", aliases[0])), flags=re.I).strip()
        rule_text = visible_text(profile.get("specialRules", {})).strip() or profile.get("bodyIndex", "").strip()
        rules = [x.strip() for x in re.split(r"\n+|,\s*(?=[A-Z])", rule_text) if x.strip() and x.strip() != "-"]
        result = {
            "name": name,
            "range": str(profile.get("range", "-")),
            "strength": str(profile.get("strength", "-")),
            "armourPiercing": str(profile.get("armourPiercing", "-")),
            "rules": rules,
            "url": SOURCE + path,
        }
        if page:
            result["page"] = page
        notes = concise_conditions(fields)
        if notes:
            result["notes"] = notes
            result["conditionEn"] = notes
        for alias in aliases:
            if normal(alias) in COMMON_NOTES:
                result["notes"] = COMMON_NOTES[normal(alias)]
                result["conditionEn"] = result["notes"]
                break
        key = json.dumps(result, sort_keys=True)
        if key not in seen:
            seen.add(key)
            distinct.append(result)
    return path, fields.get("name", ""), distinct


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    index = json.loads((DATA / "src/components/rules-index/rules-index-export.json").read_text())
    items = json.loads((DATA / "games/the-old-world/magic-items.json").read_text())
    wanted = {}
    unmapped = []

    def add(name, ref):
        task = wanted.setdefault(ref["url"], {"aliases": [], "page": ref.get("page")})
        task["aliases"].append(name)

    for name, ref in index.items():
        if ref["url"].startswith("weapons-of-war/"):
            add(name, ref)
    for faction, faction_items in items.items():
        for item in faction_items:
            if item.get("type") != "weapon":
                continue
            name = item["name"]
            ref = index.get(name)
            if not ref:
                ref = next((v for k, v in index.items() if normal(k) == normal(name)), None)
            if not ref:
                ref = next((v for k, v in index.items() if normal(k).replace(",", "") == normal(name).replace(",", "")), None)
            if ref:
                add(name, ref)
                wanted[ref["url"]]["aliases"].append(item.get("name_en", name))
            else:
                unmapped.append({"faction": faction, "name": name})
    results, failed, no_profile = {}, [], []
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(extract, path, task["aliases"], task["page"]): path for path, task in wanted.items()}
        for future in concurrent.futures.as_completed(futures):
            path = futures[future]
            done += 1
            try:
                path, title, profiles = future.result()
                if not profiles:
                    no_profile.append(path)
                    continue
                aliases = list(wanted[path]["aliases"]) + [title]
                for alias in aliases:
                    key = normal(alias)
                    if key in results and results[key] != profiles:
                        # Contextless keys must not silently choose another faction's profile.
                        existing = results[key]
                        for profile in profiles:
                            if profile not in existing:
                                existing.append(profile)
                    else:
                        results[key] = list(profiles)
            except Exception as exc:
                failed.append({"url": path, "error": str(exc)})
            if done % 50 == 0:
                print(f"Fetched {done}/{len(wanted)}", flush=True)
    for profiles in results.values():
        profiles.sort(key=lambda row: (row["url"], row["name"], row["range"], row["strength"]))
    output = {"version": 1, "source": SOURCE, "profiles": dict(sorted(results.items()))}
    (DATA / "play-weapon-profiles.json").write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n")
    report = {"requestedUrls": len(wanted), "aliases": len(results), "profileRows": sum(len(x) for x in results.values()), "unmapped": unmapped, "noProfile": no_profile, "failed": failed}
    Path("/tmp/play-weapon-profiles-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
