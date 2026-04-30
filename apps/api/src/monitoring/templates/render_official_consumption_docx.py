#!/usr/bin/env python3
import html
import json
import re
import struct
import sys
import time
import zipfile
import zlib
from pathlib import Path

def clean(value):
    if value is None:
        return "-"
    text = str(value).replace("\n", " ").replace("\r", " ")
    text = " ".join(text.split())
    return text or "-"

def esc(value):
    return html.escape(clean(value), quote=False)

def paragraph_text(xml):
    return "".join(html.unescape(match) for match in re.findall(r"<(?:w:t|a:t)[^>]*>(.*?)</(?:w:t|a:t)>", xml, flags=re.S))

def replace_text_in_paragraph_xml(paragraph_xml, value):
    matches = list(re.finditer(r"(<w:t[^>]*>)(.*?)(</w:t>)", paragraph_xml, flags=re.S))
    if not matches:
        return paragraph_xml

    first = matches[0]
    out = []
    last = 0

    for index, match in enumerate(matches):
        out.append(paragraph_xml[last:match.start()])
        if index == 0:
            out.append(match.group(1) + esc(value) + match.group(3))
        else:
            out.append(match.group(1) + "" + match.group(3))
        last = match.end()

    out.append(paragraph_xml[last:])
    return "".join(out)


def clone_paragraph(template_xml, value):
    return replace_text_in_paragraph_xml(template_xml, value)

def blank_paragraph(template_xml):
    return replace_text_in_paragraph_xml(template_xml, " ")

def page_break_paragraph():
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

def png_bytes(width, height, pixels):
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(pixels[y][x])

    def chunk(kind, data):
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )

def make_canvas(width, height, color=(255, 255, 255)):
    return [[bytearray(color) for _ in range(width)] for _ in range(height)]

def draw_rect(pixels, x1, y1, x2, y2, color):
    height = len(pixels)
    width = len(pixels[0]) if height else 0
    x1 = max(0, min(width - 1, x1))
    x2 = max(0, min(width - 1, x2))
    y1 = max(0, min(height - 1, y1))
    y2 = max(0, min(height - 1, y2))

    for x in range(x1, x2 + 1):
        pixels[y1][x][:] = color
        pixels[y2][x][:] = color
    for y in range(y1, y2 + 1):
        pixels[y][x1][:] = color
        pixels[y][x2][:] = color

def draw_line(pixels, x1, y1, x2, y2, color):
    height = len(pixels)
    width = len(pixels[0]) if height else 0

    dx = abs(x2 - x1)
    sx = 1 if x1 < x2 else -1
    dy = -abs(y2 - y1)
    sy = 1 if y1 < y2 else -1
    err = dx + dy

    while True:
        if 0 <= x1 < width and 0 <= y1 < height:
            pixels[y1][x1][:] = color

        if x1 == x2 and y1 == y2:
            break

        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x1 += sx
        if e2 <= dx:
            err += dx
            y1 += sy

def draw_grid(pixels, left, top, right, bottom):
    grid = (222, 226, 232)
    axis = (120, 127, 138)

    for i in range(1, 5):
        y = top + round((bottom - top) * i / 5)
        draw_line(pixels, left, y, right, y, grid)

    for i in range(1, 6):
        x = left + round((right - left) * i / 6)
        draw_line(pixels, x, top, x, bottom, grid)

    draw_line(pixels, left, bottom, right, bottom, axis)
    draw_line(pixels, left, top, left, bottom, axis)

MAX_CHART_POINTS = 260

def downsample_points(points, limit=MAX_CHART_POINTS):
    if len(points) <= limit:
        return points

    if limit <= 2:
        return [points[0], points[-1]]

    sampled = []
    for index in range(limit):
        source_index = round(index * (len(points) - 1) / (limit - 1))
        sampled.append(points[source_index])

    return sampled

def series_points(series):
    points = []
    for point in series.get("points", []):
        value = point.get("value")
        if value is None:
            continue
        try:
            points.append(float(value))
        except Exception:
            continue

    return downsample_points(points)

def has_useful_chart_values(block):
    values = []
    for entry in block.get("series", []):
        values.extend(series_points(entry))

    if not values:
        return False

    kind = block_kind(block)

    if kind == "traffic":
        return any(abs(value) > 0 for value in values)

    non_zero = [value for value in values if abs(value) > 0]
    if not non_zero:
        return False

    return (max(non_zero) - min(non_zero)) > 0.000001 or len(non_zero) >= 2

BITMAP_FONT = {
    " ": ["00000","00000","00000","00000","00000","00000","00000"],
    "A": ["01110","10001","10001","11111","10001","10001","10001"],
    "B": ["11110","10001","10001","11110","10001","10001","11110"],
    "C": ["01111","10000","10000","10000","10000","10000","01111"],
    "D": ["11110","10001","10001","10001","10001","10001","11110"],
    "E": ["11111","10000","10000","11110","10000","10000","11111"],
    "F": ["11111","10000","10000","11110","10000","10000","10000"],
    "G": ["01111","10000","10000","10011","10001","10001","01111"],
    "H": ["10001","10001","10001","11111","10001","10001","10001"],
    "I": ["11111","00100","00100","00100","00100","00100","11111"],
    "J": ["00111","00010","00010","00010","10010","10010","01100"],
    "K": ["10001","10010","10100","11000","10100","10010","10001"],
    "L": ["10000","10000","10000","10000","10000","10000","11111"],
    "M": ["10001","11011","10101","10101","10001","10001","10001"],
    "N": ["10001","11001","10101","10011","10001","10001","10001"],
    "O": ["01110","10001","10001","10001","10001","10001","01110"],
    "P": ["11110","10001","10001","11110","10000","10000","10000"],
    "Q": ["01110","10001","10001","10001","10101","10010","01101"],
    "R": ["11110","10001","10001","11110","10100","10010","10001"],
    "S": ["01111","10000","10000","01110","00001","00001","11110"],
    "T": ["11111","00100","00100","00100","00100","00100","00100"],
    "U": ["10001","10001","10001","10001","10001","10001","01110"],
    "V": ["10001","10001","10001","10001","10001","01010","00100"],
    "W": ["10001","10001","10001","10101","10101","10101","01010"],
    "X": ["10001","10001","01010","00100","01010","10001","10001"],
    "Y": ["10001","10001","01010","00100","00100","00100","00100"],
    "Z": ["11111","00001","00010","00100","01000","10000","11111"],
    "0": ["01110","10001","10011","10101","11001","10001","01110"],
    "1": ["00100","01100","00100","00100","00100","00100","01110"],
    "2": ["01110","10001","00001","00010","00100","01000","11111"],
    "3": ["11110","00001","00001","01110","00001","00001","11110"],
    "4": ["00010","00110","01010","10010","11111","00010","00010"],
    "5": ["11111","10000","10000","11110","00001","00001","11110"],
    "6": ["01110","10000","10000","11110","10001","10001","01110"],
    "7": ["11111","00001","00010","00100","01000","01000","01000"],
    "8": ["01110","10001","10001","01110","10001","10001","01110"],
    "9": ["01110","10001","10001","01111","00001","00001","01110"],
    "-": ["00000","00000","00000","11111","00000","00000","00000"],
    "/": ["00001","00010","00010","00100","01000","01000","10000"],
    "|": ["00100","00100","00100","00100","00100","00100","00100"],
    ":": ["00000","00100","00100","00000","00100","00100","00000"],
    ".": ["00000","00000","00000","00000","00000","01100","01100"],
    ",": ["00000","00000","00000","00000","00000","01100","01000"],
    "%": ["11001","11010","00010","00100","01000","01011","10011"],
}

def fill_rect(pixels, x1, y1, x2, y2, color):
    height = len(pixels)
    width = len(pixels[0]) if height else 0
    for y in range(max(0, y1), min(height, y2 + 1)):
        for x in range(max(0, x1), min(width, x2 + 1)):
            pixels[y][x][:] = color

def draw_text(pixels, x, y, text, color=(65, 72, 82), scale=2, max_x=None):
    cursor = x
    limit = max_x if max_x is not None else (len(pixels[0]) if pixels else 0)

    for raw_char in str(text).upper():
        char = raw_char
        if char in ["Á", "À", "Â", "Ã"]:
            char = "A"
        elif char in ["É", "Ê"]:
            char = "E"
        elif char == "Í":
            char = "I"
        elif char in ["Ó", "Ô", "Õ"]:
            char = "O"
        elif char == "Ú":
            char = "U"
        elif char == "Ç":
            char = "C"

        pattern = BITMAP_FONT.get(char, BITMAP_FONT[" "])
        char_width = len(pattern[0]) * scale

        if cursor + char_width > limit:
            break

        for row_index, row in enumerate(pattern):
            for col_index, bit in enumerate(row):
                if bit == "1":
                    fill_rect(
                        pixels,
                        cursor + col_index * scale,
                        y + row_index * scale,
                        cursor + (col_index + 1) * scale - 1,
                        y + (row_index + 1) * scale - 1,
                        color,
                    )

        cursor += char_width + scale

def draw_line_thick(pixels, x1, y1, x2, y2, color, thickness=2):
    offsets = [(0, 0)]
    if thickness >= 2:
        offsets.extend([(0, 1), (1, 0)])
    if thickness >= 3:
        offsets.extend([(0, -1), (-1, 0), (1, 1), (-1, -1)])

    for dx, dy in offsets:
        draw_line(pixels, x1 + dx, y1 + dy, x2 + dx, y2 + dy, color)

def soften_plot_area(pixels, left, top, right, bottom):
    fill_rect(pixels, left, top, right, bottom, (250, 252, 255))

def draw_area_to_baseline(pixels, coords, baseline, color):
    height = len(pixels)
    width = len(pixels[0]) if height else 0

    for x, y in coords:
        if not (0 <= x < width):
            continue

        y1 = min(y, baseline)
        y2 = max(y, baseline)
        for yy in range(max(0, y1), min(height, y2 + 1), 3):
            current = pixels[yy][x]
            current[0] = round((current[0] * 4 + color[0]) / 5)
            current[1] = round((current[1] * 4 + color[1]) / 5)
            current[2] = round((current[2] * 4 + color[2]) / 5)

def chart_value(block, key):
    consumption = block.get("consumption") or {}
    value = clean(consumption.get(key))
    return value if value != "-" else ""

def draw_chart_footer(pixels, block, left, right, footer_top, width):
    # Rodapé visual removido: os totais já aparecem no bloco Consumo do Link.
    return


def render_chart_png(block, width=1320, height=500):
    if not has_useful_chart_values(block):
        return None

    series = [entry for entry in block.get("series", []) if series_points(entry)]
    if not series:
        return None

    pixels = make_canvas(width, height, (255, 255, 255))
    footer_top = height - 12
    left, top, right, bottom = 40, 24, width - 28, footer_top - 16

    draw_rect(pixels, 0, 0, width - 1, height - 1, (219, 225, 232))
    soften_plot_area(pixels, left, top, right, bottom)
    draw_grid(pixels, left, top, right, bottom)

    values = []
    for entry in series:
        values.extend(series_points(entry))

    if not values:
        return None

    min_value = min(values)
    max_value = max(values)

    if min_value == max_value:
        min_value = 0.0
        max_value = max(max_value, 1.0)

    spread = max_value - min_value
    if spread > 0:
        max_value += spread * 0.10
        if min_value > 0:
            min_value = max(0.0, min_value - spread * 0.05)

    palette = [
        (32, 124, 229),
        (237, 125, 49),
        (112, 173, 71),
        (91, 155, 213),
        (165, 165, 165),
    ]

    for series_index, entry in enumerate(series[:5]):
        values = series_points(entry)
        if len(values) < 2:
            continue

        color = palette[series_index % len(palette)]
        coords = []

        for index, value in enumerate(values):
            x = left + round((right - left) * index / max(1, len(values) - 1))
            y = bottom - round((bottom - top) * (value - min_value) / (max_value - min_value))
            coords.append((x, y))

        if block_kind(block) == "traffic" and series_index < 2:
            draw_area_to_baseline(pixels, coords, bottom, color)

        for (x1, y1), (x2, y2) in zip(coords, coords[1:]):
            draw_line_thick(pixels, x1, y1, x2, y2, color, thickness=2)

    draw_rect(pixels, left, top, right, bottom, (207, 214, 224))
    draw_line_thick(pixels, left, bottom, right, bottom, (135, 145, 158), thickness=1)
    draw_line_thick(pixels, left, top, left, bottom, (135, 145, 158), thickness=1)

    draw_chart_footer(pixels, block, left, right, footer_top, width)

    return png_bytes(width, height, pixels)


def block_kind(block):
    text = " ".join([
        clean(block.get("title")),
        clean(block.get("description")),
        clean(block.get("sensorType")),
    ]).lower()

    if any(token in text for token in ["traffic", "tráfego", "trafego", "interface", "link", "consumo"]):
        return "traffic"
    if "ping" in text or "icmp" in text or "latência" in text or "latencia" in text:
        return "ping"
    if "uptime" in text or "disponibilidade" in text:
        return "uptime"
    return "other"

def chart_label_for_block(block):
    kind = block_kind(block)
    if kind == "traffic":
        return "Gráfico de tráfego do link"
    if kind == "ping":
        return "Gráfico de ping / latência"
    if kind == "uptime":
        return "Gráfico de uptime"
    return clean(block.get("title"))

def chart_blocks(report):
    ordered = []
    for desired in ["traffic", "ping", "uptime"]:
        for block in report.get("blocks", []):
            if block_kind(block) == desired and block.get("series"):
                png = render_chart_png(block)
                if png:
                    ordered.append((chart_label_for_block(block), png))
                    break
    return ordered

def add_image_relationship(rels_xml, rel_id, target):
    rel = (
        f'<Relationship Id="{rel_id}" '
        f'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
        f'Target="{target}"/>'
    )
    return rels_xml.replace("</Relationships>", rel + "</Relationships>")

def _hex_id(value):
    return f"{value & 0xFFFFFFFF:08X}"

def _replace_numeric_ids(xml, pattern, base_id):
    counter = 0

    def repl(match):
        nonlocal counter
        counter += 1
        return match.group(1) + str(base_id + counter) + match.group(2)

    return re.sub(pattern, repl, xml)

def image_paragraph(template_xml, rel_id, unique_id):
    xml = re.sub(
        r'((?:r|ns\d+):embed=")rId[^"]+(")',
        lambda match: match.group(1) + rel_id + match.group(2),
        template_xml,
        count=1,
    )

    # Word é sensível a IDs duplicados em imagens clonadas.
    # Atualiza docPr e cNvPr, não apenas o relacionamento da imagem.
    xml = _replace_numeric_ids(
        xml,
        r'(<(?:wp:docPr|ns\d+:docPr)\b[^>]*\bid=")\d+(")',
        unique_id,
    )
    xml = _replace_numeric_ids(
        xml,
        r'(<(?:pic:cNvPr|ns\d+:cNvPr)\b[^>]*\bid=")\d+(")',
        unique_id + 100,
    )

    xml = re.sub(
        r'((?:wp14:|ns\d+:)?anchorId=")[0-9A-Fa-f]+(")',
        lambda match: match.group(1) + _hex_id(unique_id) + match.group(2),
        xml,
    )
    xml = re.sub(
        r'((?:wp14:|ns\d+:)?editId=")[0-9A-Fa-f]+(")',
        lambda match: match.group(1) + _hex_id(unique_id + 1) + match.group(2),
        xml,
    )

    xml = resize_image_paragraph(xml)
    return xml

def resize_image_paragraph(xml, cx=6116320, cy=1350000):
    xml = re.sub(
        r'(<(?:wp:extent|ns\d+:extent)\b[^>]*\bcx=")\d+(" cy=")\d+(")',
        lambda match: match.group(1) + str(cx) + match.group(2) + str(cy) + match.group(3),
        xml,
        count=1,
    )
    xml = re.sub(
        r'(<(?:a:ext|ns\d+:ext)\b[^>]*\bcx=")\d+(" cy=")\d+(")',
        lambda match: match.group(1) + str(cx) + match.group(2) + str(cy) + match.group(3),
        xml,
        count=1,
    )
    return xml

def keep_with_next(paragraph_xml):
    if "<w:keepNext" in paragraph_xml:
        return paragraph_xml

    if "<w:pPr>" in paragraph_xml:
        return paragraph_xml.replace("<w:pPr>", "<w:pPr><w:keepNext/>", 1)

    return re.sub(
        r'(<w:p\b[^>]*>)',
        r'\1<w:pPr><w:keepNext/></w:pPr>',
        paragraph_xml,
        count=1,
    )

def consumption_lines(report):
    for block in report.get("blocks", []):
        searchable = " ".join([
            clean(block.get("title")),
            clean(block.get("description")),
            clean(block.get("sensorType")),
        ]).lower()
        consumption = block.get("consumption") or {}
        if not consumption:
            continue
        if not any(token in searchable for token in ["traffic", "tráfego", "trafego", "consumo", "interface", "link"]):
            continue

        return [
            ("Consumo do Link", None),
            ("Download / Recebido", consumption.get("receivedLabel") or "-"),
            ("Upload / Enviado", consumption.get("sentLabel") or "-"),
            ("Total Trafegado", consumption.get("totalLabel") or "-"),
            ("Pico Download", consumption.get("peakReceiveLabel") or "-"),
            ("Pico Upload", consumption.get("peakSendLabel") or "-"),
        ]

    return []

TEXT_RUN_RE = re.compile(r"(<(?:w:t|a:t)\b[^>]*>)(.*?)(</(?:w:t|a:t)>)", re.S)

def raw_replacement(value):
    if value is None:
        return ""
    return str(value).replace("\n", " ").replace("\r", " ")

def replace_visible_text_once(xml, old, new):
    if not old:
        return xml, False

    replacement_value = raw_replacement(new)
    if old == replacement_value:
        return xml, False

    matches = list(TEXT_RUN_RE.finditer(xml))
    if not matches:
        return xml, False

    runs = []
    visible_parts = []
    cursor = 0

    for match in matches:
        raw_value = match.group(2)
        visible_value = html.unescape(raw_value)
        start_pos = cursor
        end_pos = cursor + len(visible_value)

        runs.append({
            "match": match,
            "text": visible_value,
            "start": start_pos,
            "end": end_pos,
        })

        visible_parts.append(visible_value)
        cursor = end_pos

    visible = "".join(visible_parts)
    hit = visible.find(old)

    if hit == -1:
        return xml, False

    hit_end = hit + len(old)
    affected = [
        index
        for index, run in enumerate(runs)
        if run["end"] > hit and run["start"] < hit_end
    ]

    if not affected:
        return xml, False

    first = affected[0]
    last = affected[-1]
    edits = []

    for index in affected:
        run = runs[index]
        match = run["match"]
        run_text = run["text"]
        run_start = run["start"]

        if first == last:
            prefix = run_text[:hit - run_start]
            suffix = run_text[hit_end - run_start:]
            replacement = prefix + replacement_value + suffix
        elif index == first:
            prefix = run_text[:hit - run_start]
            replacement = prefix + replacement_value
        elif index == last:
            suffix = run_text[hit_end - run_start:]
            replacement = suffix
        else:
            replacement = ""

        edits.append((match.start(2), match.end(2), esc(replacement)))

    for edit_start, edit_end, replacement in reversed(edits):
        xml = xml[:edit_start] + replacement + xml[edit_end:]

    return xml, True

def replace_visible_text(xml, old, new, max_replacements=40):
    for _ in range(max_replacements):
        xml, changed = replace_visible_text_once(xml, old, new)
        if not changed:
            break
    return xml

def replace_core_subject(xml, month):
    if "<dc:subject>" in xml:
        xml = re.sub(
            r"(<dc:subject>)(.*?)(</dc:subject>)",
            lambda match: match.group(1) + esc(month) + match.group(3),
            xml,
            count=1,
            flags=re.S,
        )
    return xml

def remove_hyphen_debris(xml):
    # Remove sobras como "----" em textos do Word, sem tocar em hífen simples.
    def cleanup(match):
        open_tag, value, close_tag = match.groups()
        value = re.sub(r"-{2,}", "", value)
        return open_tag + value + close_tag

    return re.sub(
        r"(<(?:w:t|a:t)\b[^>]*>)(.*?)(</(?:w:t|a:t)>)",
        cleanup,
        xml,
        flags=re.S,
    )


def remove_only_hyphen_runs(xml):
    # Remove apenas textos que são hífens isolados em w:t/a:t.
    # Não altera frases com hífen, como "Araguaçu - TO".
    for tag in ["w:t", "a:t"]:
        xml = re.sub(rf"(<{tag}\b[^>]*>)\s*-+\s*(</{tag}>)", rf"\1\2", xml)
    return xml

def replace_template_text(xml, payload):
    month = clean(payload.get("monthSlashLabel"))
    place_date = clean(payload.get("placeDate"))
    interested = clean(payload.get("interestedParty"))

    # Troca direta para XML simples, incluindo docProps/core.xml.
    direct_replacements = [
        ("Secretaria de Infraestrutura de Gurupi", interested),
        ("Palmas, 06 de abril de 2026", place_date),
        ("Março/2026", month),
        ("Marco/2026", month),
        ("Mar/2026", month),
        ("Janeiro/2025", month),
    ]

    for old, new in direct_replacements:
        xml = xml.replace(old, esc(new))

    xml = replace_core_subject(xml, month)

    # Troca segura para textos quebrados em múltiplos w:t/a:t.
    for old, new in direct_replacements:
        xml = replace_visible_text(xml, old, new)

    # Remove sobras de hífen depois dos campos substituídos.
    for suffix in ["--------", "-------", "------", "-----", "----", "---", "--", "-"]:
        xml = replace_visible_text(xml, interested + suffix, interested, max_replacements=10)
        xml = replace_visible_text(xml, place_date + suffix, place_date, max_replacements=10)
        xml = replace_visible_text(xml, month + suffix, month, max_replacements=10)

    xml = remove_hyphen_debris(xml)

    xml = remove_only_hyphen_runs(xml)

    return xml
def main():
    if len(sys.argv) != 4:
        raise SystemExit("uso: render_official_consumption_docx.py TEMPLATE PAYLOAD_JSON OUT_DOCX")

    template_path = Path(sys.argv[1])
    payload_path = Path(sys.argv[2])
    output_path = Path(sys.argv[3])

    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    reports = payload.get("reports", [])

    with zipfile.ZipFile(template_path, "r") as zin:
        document_xml = zin.read("word/document.xml").decode("utf-8")
        document_xml = replace_template_text(document_xml, payload)
        document_rels_xml = zin.read("word/_rels/document.xml.rels").decode("utf-8")
        generated_media = {}

        paragraphs = list(re.finditer(r"<w:p\b[\s\S]*?</w:p>", document_xml))
        if not paragraphs:
            raise SystemExit("não encontrei parágrafos no document.xml")

        start_match = None
        for match in paragraphs:
            text = paragraph_text(match.group(0))
            if "48341" in text or "SEC. DE INFRAESTRUTURA SEDE" in text:
                start_match = match
                break

        if start_match is None:
            raise SystemExit("não encontrei início do bloco de unidades no template")

        footer_match = None
        for match in paragraphs:
            if match.start() <= start_match.start():
                continue
            text = paragraph_text(match.group(0))
            if "Q. 106 Norte" in text:
                footer_match = match
                break

        if footer_match is None:
            sect_match = re.search(r"<w:sectPr\b[\s\S]*?</w:sectPr>", document_xml[start_match.end():])
            if sect_match:
                footer_start = start_match.end() + sect_match.start()
            else:
                footer_start = document_xml.rfind("</w:body>")
        else:
            footer_start = footer_match.start()

        unit_block_xml = document_xml[start_match.start():footer_start]
        unit_paragraphs = re.findall(r"<w:p\b[\s\S]*?</w:p>", unit_block_xml)

        if not unit_paragraphs:
            raise SystemExit("não encontrei parágrafos no bloco de unidades do template")

        def find_template(*needles):
            for pxml in unit_paragraphs:
                txt = paragraph_text(pxml)
                if all(needle in txt for needle in needles):
                    return pxml
            return unit_paragraphs[0]

        title_tpl = find_template("SEC.")
        contract_tpl = find_template("Contrato")
        address_tpl = find_template("Endereço")
        bandwidth_tpl = find_template("Banda")
        blank_tpl = next((p for p in unit_paragraphs if not paragraph_text(p).strip()), unit_paragraphs[0])
        image_templates = [p for p in unit_paragraphs if "<w:drawing>" in p and re.search(r'(?:r|ns\d+):embed="rId', p)]
        image_tpl = image_templates[0] if image_templates else None

        new_units = []

        for index, report in enumerate(reports):
            unit = report.get("unit", {})
            metadata = report.get("metadata", {})
            title = f"{clean(unit.get('code'))} – {clean(unit.get('name'))}"

            if index > 0:
                new_units.extend(blank_paragraph(blank_tpl) for _ in range(3))
                new_units.append(page_break_paragraph())

            new_units.append(clone_paragraph(title_tpl, title))
            new_units.append(clone_paragraph(contract_tpl, f"Contrato: {clean(metadata.get('contractLabel'))}"))
            new_units.append(clone_paragraph(address_tpl, f"Endereço: {clean(metadata.get('addressLine'))}"))
            new_units.append(clone_paragraph(bandwidth_tpl, f"Banda Contratada: {clean(metadata.get('contractedBandwidth'))}"))

            notes = clean(metadata.get("notes"))
            if notes != "-":
                new_units.append(blank_paragraph(blank_tpl))
                new_units.append(clone_paragraph(contract_tpl, f"*{notes}"))

            lines = consumption_lines(report)
            if lines:
                new_units.append(blank_paragraph(blank_tpl))
                for label, value in lines:
                    if value is None:
                        new_units.append(clone_paragraph(contract_tpl, label))
                    else:
                        new_units.append(clone_paragraph(contract_tpl, f"{label}: {clean(value)}"))

            charts = chart_blocks(report) if payload.get("options", {}).get("includeCharts") else []
            if charts and image_tpl:
                for chart_index, (chart_label, chart_png) in enumerate(charts):
                    rel_id = f"rIdNovaChart{index + 1}_{chart_index + 1}"
                    media_name = f"word/media/nova_chart_{index + 1}_{chart_index + 1}.png"
                    generated_media[media_name] = chart_png
                    document_rels_xml = add_image_relationship(
                        document_rels_xml,
                        rel_id,
                        f"media/nova_chart_{index + 1}_{chart_index + 1}.png",
                    )

                    new_units.append(blank_paragraph(blank_tpl))
                    new_units.append(keep_with_next(clone_paragraph(contract_tpl, chart_label)))
                    new_units.append(image_paragraph(image_tpl, rel_id, 1900000000 + ((index + 1) * 10) + (chart_index + 1)))

            new_units.extend(blank_paragraph(blank_tpl) for _ in range(3))

        document_xml = (
            document_xml[:start_match.start()]
            + "".join(new_units)
            + document_xml[footer_start:]
        )

        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "word/document.xml":
                    data = document_xml.encode("utf-8")
                elif item.filename == "word/_rels/document.xml.rels":
                    data = document_rels_xml.encode("utf-8")
                elif (
                    item.filename.endswith(".xml")
                    and (
                        item.filename.startswith("word/")
                        or item.filename.startswith("docProps/")
                        or item.filename.startswith("customXml/")
                    )
                ):
                    data = replace_template_text(data.decode("utf-8"), payload).encode("utf-8")
                zout.writestr(item, data)

            for media_name, media_data in generated_media.items():
                zout.writestr(media_name, media_data)

if __name__ == "__main__":
    main()
