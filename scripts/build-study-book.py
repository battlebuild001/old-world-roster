#!/usr/bin/env python3
"""Assemble the authored reading edition and verify its complete source mapping."""
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'dist/data/document-rulebook.json'
PARTS = ROOT / 'scripts/study-book'
GROUPS = [
    ('foundations', '전장을 읽는 기초', 'Read the battlefield', 0, 8),
    ('battle', '한 턴을 플레이하기', 'Play a complete turn', 8, 14),
    ('specials', '규칙의 차이를 이해하기', 'Understand the exceptions', 14, 18),
    ('army', '군대와 전장', 'Armies & battlefields', 18, 25),
    ('reference', '마법과 실전 참조', 'Magic & reference', 25, 30),
]


def check(condition, message):
    if not condition:
        raise ValueError(message)


def reading_spacing(value):
    """Separate Korean prose from following notation without changing values."""
    if isinstance(value, dict):
        return {key: reading_spacing(item) for key, item in value.items()}
    if isinstance(value, list):
        return [reading_spacing(item) for item in value]
    if isinstance(value, str):
        return re.sub(r'([가-힣])(?=[A-Za-z0-9]|[+−-]\d)', r'\1 ', value)
    return value


def build():
    source = json.loads(SOURCE.read_text())
    authored = []
    for part in sorted(PARTS.glob('part-*.json')):
        pack = json.loads(part.read_text())
        check(isinstance(pack, list), f'{part.name} must contain chapter array')
        authored.extend(reading_spacing(pack))
    check(len(authored) == len(source['chapters']) == 30, 'All 30 authored chapters required')
    chapter_map = {chapter['id']: chapter for chapter in authored}
    check(len(chapter_map) == 30, 'Duplicate authored chapter')
    section_map = {section['id']: section for section in source['sections']}
    used, lesson_ids, chapters = [], set(), []
    for index, origin in enumerate(source['chapters']):
        chapter = chapter_map[origin['id']]
        for field in ('title', 'subtitle', 'intro', 'outcomes', 'lessons'):
            check(chapter.get(field), f'{chapter["id"]} missing {field}')
        check(len(chapter['intro']) >= 45, f'{chapter["id"]} needs authored introduction')
        chapter['number'] = index + 1
        chapter['groupId'] = next(group[0] for group in GROUPS if group[3] <= index < group[4])
        owned = []
        for lesson in chapter['lessons']:
            ident = lesson['id']
            check(ident and ident not in lesson_ids, f'Duplicate lesson {ident}')
            lesson_ids.add(ident)
            for field in ('title', 'lead', 'takeaway', 'steps', 'example', 'sourceSectionIds'):
                check(lesson.get(field), f'{ident} missing {field}')
            check(len(lesson['lead']) >= 50, f'{ident} needs explanatory prose')
            check(all(step.get('title') and step.get('body') for step in lesson['steps']), f'{ident} incomplete step')
            check(lesson['example'].get('situation') and lesson['example'].get('resolution'), f'{ident} incomplete example')
            check(len(lesson.get('exceptions', [])) >= 1, f'{ident} missing exceptions')
            lesson['chapterId'] = chapter['id']
            blocks = []
            for section_id in lesson['sourceSectionIds']:
                check(section_id in section_map, f'{ident} unknown source {section_id}')
                section = section_map[section_id]
                check(section['chapterId'] == chapter['id'], f'{ident} cross-chapter source')
                blocks.extend(section['blocks'])
                owned.append(section_id)
            figures = list(dict.fromkeys(Path(image['src']).stem for block in blocks for image in block.get('images', [])))
            tables = [block['id'] for block in blocks if block['type'] == 'table']
            check(set(lesson.get('figureIds', [])) <= set(figures), f'{ident} invalid figure')
            check(set(lesson.get('tableBlockIds', [])) <= set(tables), f'{ident} invalid table')
            lesson['figureIds'], lesson['tableBlockIds'] = figures, tables
            lesson['sourceTitles'] = [section_map[s]['title'] for s in lesson['sourceSectionIds']]
            if diagram := lesson.get('diagram'):
                check(diagram.get('type') == 'flow' and diagram.get('title') and 2 <= len(diagram.get('nodes', [])) <= 8, f'{ident} invalid diagram')
                check(diagram.get('caption'), f'{ident} diagram needs explanation')
        check(Counter(owned) == Counter(origin['sectionIds']), f'{chapter["id"]} does not partition all source sections exactly once')
        used.extend(owned)
        chapters.append(chapter)
    check(Counter(used) == Counter(section_map.keys()), 'Source coverage must be complete and unique')
    lessons = [lesson for chapter in chapters for lesson in chapter['lessons']]
    leads = [lesson['lead'] for lesson in lessons]
    check(len(set(leads)) == len(leads), 'Repeated lesson lead')
    counts = {'chapters': len(chapters), 'lessons': len(lessons), 'sourceSections': len(used),
              'diagrams': sum(bool(lesson.get('diagram')) for lesson in lessons),
              'tables': sum(len(lesson['tableBlockIds']) for lesson in lessons),
              'figures': sum(len(lesson['figureIds']) for lesson in lessons)}
    check(counts['tables'] == 81 and counts['figures'] == 62, 'Every source table and figure must remain available in context')
    output = {'schemaVersion': 1, 'metadata': {
        'title': '올드 월드 룰북', 'subtitle': 'THE OLD WORLD · FIELD MANUAL',
        'description': '규칙이 연결되는 이유부터 실제 주사위 판정까지, 한 수업씩 배우는 올드 월드.',
        'language': 'ko', 'counts': counts,
        'sourceNote': '제공된 한국어 문서와 확인된 정정을 바탕으로 새로 편집한 비공식 학습서입니다. 원문과 정정 근거는 각 수업에서 펼쳐볼 수 있습니다.',
        'languageNote': '설명 본문은 한국어로 작성되어 있습니다. 영어 제목은 자료 대조를 위해 함께 표시합니다.'},
        'groups': [{'id': g[0], 'title': g[1], 'subtitle': g[2]} for g in GROUPS], 'chapters': chapters}
    target = ROOT / 'dist/data/study-rulebook.json'
    target.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps(counts, ensure_ascii=False))


if __name__ == '__main__':
    build()
