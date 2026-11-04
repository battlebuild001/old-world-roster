#!/usr/bin/env python3
"""Build a searchable reading edition from the supplied Korean DOCX.

Only visible document content and pixel-equivalent figures are published. Word
properties, document authors, attachment identifiers and machine paths are not.
Every substantive source block is accounted for in the output coverage ledger.
"""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from io import BytesIO
import json
from pathlib import Path
import re
from zipfile import ZipFile
import xml.etree.ElementTree as ET

from PIL import Image


NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
W = "{" + NS["w"] + "}"
R = "{" + NS["r"] + "}"

# Reviewed source boundaries, rather than ambiguous short headings such as
# "Characters" that also occur inside the profiles and troop-type chapters.
CHAPTERS = [
    (6, "overview", "게임 개요", "Overview of the Game"),
    (36, "principles", "일반 원칙", "General Principles"),
    (132, "profiles", "모델 프로필", "Model Profiles"),
    (286, "formations", "유닛 구성", "Forming Units"),
    (349, "casualties", "사상자 제거", "Removing Casualties"),
    (377, "facing", "모델과 유닛의 전방", "Model & Unit Facing"),
    (402, "troop-types", "병종 한눈에 보기", "Troop Types at a Glance"),
    (461, "magic", "마법", "Magic"),
    (701, "turn", "턴 진행 순서", "The Turn Sequence"),
    (750, "strategy", "전략 페이즈", "The Strategy Phase"),
    (825, "movement", "이동 페이즈", "The Movement Phase"),
    (1040, "movement-detail", "이동 상세 규칙", "Movement in Detail"),
    (1570, "shooting", "사격 페이즈", "The Shooting Phase"),
    (1911, "combat", "전투 페이즈", "The Combat Phase"),
    (2602, "psychology", "전쟁의 심리학", "The Psychology of War"),
    (2677, "special-rules", "특수 규칙", "Special Rules"),
    (3210, "unusual-formations", "특수 대형", "Unusual Formations"),
    (3367, "troop-detail", "병종 유형 상세", "Troop Types in Detail"),
    (3592, "command", "커맨드 그룹", "Command Groups"),
    (3694, "characters", "캐릭터", "Characters"),
    (3960, "weapons", "전쟁의 무기", "Weapons of War"),
    (4200, "war-machines", "워 머신", "War Machines"),
    (4373, "terrain", "전장 지형", "Battlefield Terrain"),
    (4627, "armies", "워해머 아미", "Warhammer Armies"),
    (4818, "battles", "워해머 전투", "Warhammer Battles"),
    (5199, "battle-march", "배틀 마치", "Battle March"),
    (5338, "realms", "마법의 영역", "Realms of Magic"),
    (5391, "lores", "마법의 학파", "The Lores of Magic"),
    (5670, "magic-items", "마법 아이템", "Magic Items"),
    (5875, "quick-reference", "퀵 레퍼런스", "Quick Reference"),
]

NOTICE_LINES = {
    "모든 저작권은 게임즈워크샵에 있으며 해당 번역본은",
    "어떠한 수익 창출의 목적도 없습니다.",
    "해당 번역본을 이용한 수익 활동은 엄격히 금합니다.",
}


def paragraph_text(element):
    pieces = []
    for child in element.iter():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "t" and child.text:
            pieces.append(child.text)
        elif tag == "tab":
            pieces.append("\t")
        elif tag in {"br", "cr"}:
            pieces.append("\n")
    return "".join(pieces).strip()


def source_table(element):
    rows, cells = [], []
    active = {}
    for row_index, tr in enumerate(element.findall("w:tr", NS)):
        strings, rich, next_active = [], [], {}
        grid_column = 0
        header = row_index == 0 or tr.find("w:trPr/w:tblHeader", NS) is not None
        for tc in tr.findall("w:tc", NS):
            value = "\n".join(paragraph_text(p) for p in tc.findall("w:p", NS)).strip()
            span_tag = tc.find("w:tcPr/w:gridSpan", NS)
            span = int(span_tag.get(W + "val", "1")) if span_tag is not None else 1
            merge = tc.find("w:tcPr/w:vMerge", NS)
            continuation = merge is not None and merge.get(W + "val", "continue") != "restart"
            previous = active.get(grid_column)
            if continuation and previous is not None and not value:
                previous["rowSpan"] += 1
                rich.append(None)
                for col in range(grid_column, grid_column + span):
                    next_active[col] = previous
            else:
                cell = {"text": value, "colSpan": span, "rowSpan": 1, "header": header}
                rich.append(cell)
                if merge is not None and not continuation:
                    for col in range(grid_column, grid_column + span):
                        next_active[col] = cell
            strings.append(value)
            grid_column += span
        rows.append(strings)
        cells.append(rich)
        active = next_active
    return rows, cells


def extract(source):
    with ZipFile(source) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
        rels = ET.fromstring(archive.read("word/_rels/document.xml.rels"))
        relationships = {entry.get("Id"): entry.get("Target") for entry in rels}
        blocks = []
        for element in root.find("w:body", NS):
            tag = element.tag.rsplit("}", 1)[-1]
            if tag == "p":
                text = paragraph_text(element)
                images = [relationships.get(blip.get(R + "embed"), "")
                          for blip in element.findall(".//a:blip", NS)]
                if not text and not images:
                    continue
                blocks.append({"type": "paragraph", "text": text, "sourceImages": images})
            elif tag == "tbl":
                rows, cells = source_table(element)
                blocks.append({"type": "table", "rows": rows, "cells": cells})
        for number, block in enumerate(blocks, 1):
            block["id"] = f"B{number:05d}"
        media = {name: archive.read(name) for name in archive.namelist()
                 if name.startswith("word/media/")}
    if len(blocks) != 6050:
        raise ValueError(f"Source changed: expected 6,050 reviewed blocks, found {len(blocks)}")
    if sum(block["type"] == "table" for block in blocks) != 81 or len(media) != 62:
        raise ValueError("Source table or figure count changed; review source boundaries before publishing")
    return blocks, media


def title_pair(text):
    value = re.sub(r"^[■•]\s*", "", text).strip()
    # Find an English outer parenthesis, retaining nested parameters such as (X).
    for match in re.finditer(r"\(", value):
        tail = value[match.end():]
        if re.match(r"\s*[A-Za-z][A-Za-z]", tail):
            depth, closing = 1, None
            for at in range(match.end(), len(value)):
                if value[at] == "(":
                    depth += 1
                elif value[at] == ")":
                    depth -= 1
                    if depth == 0:
                        closing = at
                        break
            if closing is not None:
                ko = (value[:match.start()] + value[closing + 1:]).strip(" —–-")
                en = value[match.end():closing].strip()
                return {"ko": ko or en, "en": en}
    if "—" in value:
        first, last = [part.strip() for part in value.split("—", 1)]
        if (re.search(r"[A-Za-z]", first) and re.search(r"[가-힣]", last)
                and not re.fullmatch(r"\d+\s*페이지", last)):
            return {"ko": last, "en": first}
        if re.fullmatch(r"\d+\s*페이지", last) and re.search(r"[A-Za-z]", first):
            return {"ko": value, "en": first}
    return {"ko": value, "en": value}


def omit_reason(block):
    if block["type"] != "paragraph" or block.get("sourceImages"):
        return None
    text = block["text"]
    if not text:
        return "blank"
    if re.fullmatch(r"올드월드\s+[룩룰]북\s+\d+(?:-\d+)?권", text):
        return "repeated-volume-cover"
    if text == "(2026)":
        return "repeated-cover-year"
    if text in NOTICE_LINES:
        return "copyright-notice-shown-once-in-book-information"
    return None


def prepare_images(media, destination):
    destination.mkdir(parents=True, exist_ok=True)

    def convert(item):
        source_name, raw = item
        number = int(re.search(r"\d+", Path(source_name).stem)[0])
        filename = f"figure-{number:02d}.webp"
        original = Image.open(BytesIO(raw)).convert("RGBA")
        output = destination / filename
        reuse = False
        if output.exists():
            try:
                previous = Image.open(output)
                reuse = (not previous.info.get("exif") and not previous.info.get("xmp")
                         and previous.size == original.size
                         and previous.convert("RGBA").tobytes() == original.tobytes())
            except OSError:
                pass
        if not reuse:
            original.save(output, format="WEBP", lossless=True, method=6, exact=True)
        decoded = Image.open(output).convert("RGBA")
        if decoded.size != original.size or decoded.tobytes() != original.tobytes():
            raise ValueError(f"Figure pixels changed: {filename}")
        if decoded.info.get("exif") or decoded.info.get("xmp"):
            raise ValueError(f"Private image metadata was retained: {filename}")
        return source_name, {"id": f"figure-{number:02d}",
                             "src": f"./document-book-images/{filename}",
                             "width": original.width, "height": original.height,
                             "sourceBytes": len(raw), "publishedBytes": output.stat().st_size}

    with ThreadPoolExecutor(max_workers=4) as pool:
        assets = dict(pool.map(convert, sorted(media.items())))
    expected = {Path(asset["src"]).name for asset in assets.values()}
    for old in destination.iterdir():
        if old.is_file() and old.name not in expected:
            old.unlink()
    return assets


def read_reviews(path):
    if not path or not path.exists():
        return []
    value = json.loads(path.read_text())
    reviews = value if isinstance(value, list) else value.get("notes", value.get("reviews", []))
    if len({note["id"] for note in reviews}) != len(reviews):
        raise ValueError("Duplicate correction identifiers")
    return reviews


def apply_reviews(blocks, reviews):
    by_id = {block["id"]: block for block in blocks}
    for note in reviews:
        impacted = set(note.get("blocks", []))
        patches = note.get("patches", [])
        if patches and note.get("status") != "verified":
            raise ValueError(f"Unverified note attempted to alter the text: {note['id']}")
        if patches and not note.get("sources"):
            raise ValueError(f"Verified correction requires sources: {note['id']}")
        for patch in patches:
            block = by_id[patch["blockId"]]
            impacted.add(block["id"])
            field = patch.get("field", "text")
            if field == "text":
                before = block.get("text", "")
                block.setdefault("originalText", before)
            elif field == "table-cell":
                row, column = patch["row"], patch["column"]
                before = block["rows"][row][column]
                block.setdefault("originalRows", deepcopy(block["rows"]))
            else:
                raise ValueError(f"Unsupported patch field: {field}")
            original, replacement = patch["from"], patch["to"]
            if not original or original not in before:
                raise ValueError(f"Correction did not match {block['id']}: {note['id']}")
            after = before.replace(original, replacement, patch.get("count", 1))
            if field == "text":
                block["text"] = after
            else:
                block["rows"][row][column] = after
                if block["cells"][row][column] is not None:
                    block["cells"][row][column]["text"] = after
        for block_id in impacted:
            if block_id not in by_id:
                raise ValueError(f"Review references unknown block: {block_id}")
            by_id[block_id].setdefault("reviews", []).append(note["id"])


def build(source, output, review_file, coverage_file):
    blocks, media = extract(source)
    reviews = read_reviews(review_file)
    apply_reviews(blocks, reviews)
    assets = prepare_images(media, output / "document-book-images")
    chapters = [{"id": "doc-" + slug, "title": {"ko": ko, "en": en}, "sectionIds": []}
                for _, slug, ko, en in CHAPTERS]
    boundaries = {number: chapters[index] for index, (number, *_rest) in enumerate(CHAPTERS)}
    sections, omitted, included = [], [], []
    chapter, section = chapters[0], None
    figure_refs = []
    for number, original in enumerate(blocks, 1):
        reason = omit_reason(original)
        if reason:
            omitted.append({"id": original["id"], "reason": reason})
            continue
        block = deepcopy(original)
        if number in boundaries:
            chapter = boundaries[number]
        is_heading = block.get("text", "").lstrip().startswith("■") or number in boundaries
        if is_heading or section is None or section["chapterId"] != chapter["id"]:
            title = chapter["title"] if number in boundaries else title_pair(block.get("text", ""))
            section = {"id": "doc-" + block["id"].lower(), "chapterId": chapter["id"],
                       "title": title, "blocks": []}
            sections.append(section)
            chapter["sectionIds"].append(section["id"])
        if is_heading:
            block["type"] = "heading"
        images = []
        for rel in block.pop("sourceImages", []):
            source_name = "word/" + rel.lstrip("/")
            if source_name not in assets:
                raise ValueError(f"Missing source figure relationship in {block['id']}")
            asset = assets[source_name]
            item = {key: asset[key] for key in ["id", "src", "width", "height"]}
            figure_number = int(re.search(r"\d+", asset["id"])[0])
            item["alt"] = f"{section['title']['ko']} — 문서 도해 {figure_number}"
            item["caption"] = {"ko": f"도해 {figure_number} · {section['title']['ko']}",
                               "en": f"Figure {figure_number} · {section['title']['en']}"}
            images.append(item)
            figure_refs.append({"blockId": block["id"], "figureId": asset["id"], "src": asset["src"]})
        if images:
            block["images"] = images
            if not block.get("text"):
                block["type"] = "figure"
        section["blocks"].append(block)
        included.append(block["id"])
    full = {block["id"] for block in blocks}
    included_set, omitted_set = set(included), {entry["id"] for entry in omitted}
    if included_set & omitted_set or included_set | omitted_set != full:
        raise ValueError("Document coverage is incomplete or duplicated")
    if (len(figure_refs) != len(media)
            or {item["figureId"] for item in figure_refs} != {item["id"] for item in assets.values()}):
        raise ValueError("A document figure was not published exactly once")
    all_published = [block for section in sections for block in section["blocks"]]
    counts = {"chapters": len(chapters), "sections": len(sections), "sourceBlocks": len(blocks),
              "publishedBlocks": len(all_published), "tables": sum(b["type"] == "table" for b in all_published),
              "figures": len(figure_refs), "reviews": len(reviews),
              "verifiedCorrections": sum(note.get("status") == "verified" for note in reviews)}
    ledger = {"totalSourceBlocks": len(blocks), "includedIds": included, "omitted": omitted,
              "nativeTables": 81, "figures": len(figure_refs), "figureReferences": figure_refs,
              "omissionReasons": dict(Counter(item["reason"] for item in omitted)),
              "allSubstantiveContentIncluded": True, "allFiguresPixelEquivalent": True,
              "sourceImageBytes": sum(asset["sourceBytes"] for asset in assets.values()),
              "publishedImageBytes": sum(asset["publishedBytes"] for asset in assets.values())}
    result = {
        "schemaVersion": 1,
        "metadata": {
            "title": {"ko": "올드 월드 전체 룰북", "en": "The Old World Document Rulebook"},
            "year": 2026, "language": "ko", "declaredPages": 347,
            "sourceLabel": {"ko": "제공된 한국어 번역 룰북 (2026)", "en": "Supplied Korean translation (2026)"},
            "scopeNote": {"ko": "제공 문서의 본문·표·도해를 수록했습니다. 마지막 2-1·2-2·2-3권은 표지만 있어 별도 본문을 포함하지 않습니다.",
                          "en": "Contains the supplied document's text, tables and figures. The trailing 2-1, 2-2 and 2-3 volume covers contain no additional body text."},
            "copyrightNotice": "모든 저작권은 게임즈워크샵에 있으며 해당 번역본은 어떠한 수익 창출의 목적도 없습니다. 해당 번역본을 이용한 수익 활동은 엄격히 금합니다.",
            "editingNote": {"ko": "반복 표지와 저작권 안내는 책 정보에 모았습니다. 확인된 정정에는 근거를 붙였으며, 미확인 상충은 검토 표시로 남겼습니다.",
                            "en": "Repeated covers and copyright notices are consolidated here. Verified edits carry references; unresolved conflicts remain marked for review."},
            "counts": counts,
        },
        "chapters": chapters, "sections": sections, "reviews": reviews, "coverage": ledger,
    }
    output.mkdir(parents=True, exist_ok=True)
    data_file = output / "data/document-rulebook.json"
    data_file.parent.mkdir(parents=True, exist_ok=True)
    data_file.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
    coverage_file.parent.mkdir(parents=True, exist_ok=True)
    coverage_file.write_text(json.dumps({"counts": counts, "coverage": ledger}, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({**counts, "jsonBytes": data_file.stat().st_size,
                      "sourceImageBytes": ledger["sourceImageBytes"],
                      "publishedImageBytes": ledger["publishedImageBytes"]}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parents[1] / "dist")
    parser.add_argument("--review-file", type=Path, default=Path(__file__).resolve().with_name("document-rulebook-corrections.json"))
    parser.add_argument("--coverage-file", type=Path, default=Path(__file__).resolve().with_name("document-book-coverage.json"))
    args = parser.parse_args()
    build(args.source, args.output_dir, args.review_file, args.coverage_file)
