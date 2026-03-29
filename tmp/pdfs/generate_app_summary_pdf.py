from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


PAGE_WIDTH, PAGE_HEIGHT = LETTER
MARGIN = 36
GUTTER = 16
LEFT_COL_W = 255
RIGHT_COL_W = PAGE_WIDTH - (MARGIN * 2) - GUTTER - LEFT_COL_W

BG = HexColor("#f4f8fc")
CARD = HexColor("#ffffff")
TEXT = HexColor("#16304f")
MUTED = HexColor("#5d7494")
ACCENT = HexColor("#2f6bff")
LINE = HexColor("#d9e6f8")
SOFT = HexColor("#eef5ff")


def wrap_text(text, font_name, font_size, width):
    words = text.split()
    lines = []
    current = ""

    for word in words:
        candidate = word if not current else f"{current} {word}"
        if stringWidth(candidate, font_name, font_size) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word

    if current:
        lines.append(current)

    return lines


def draw_box(c, x, y_top, width, title, body_lines, body_font="Helvetica", body_size=9.2, leading=12.0):
    title_h = 14
    inner_pad = 11
    chip_gap = 7
    body_h = len(body_lines) * leading
    height = inner_pad + title_h + chip_gap + body_h + inner_pad

    y = y_top - height
    c.setFillColor(CARD)
    c.setStrokeColor(LINE)
    c.roundRect(x, y, width, height, 14, fill=1, stroke=1)

    chip_w = stringWidth(title, "Helvetica-Bold", 8.5) + 16
    chip_h = 16
    chip_y = y_top - inner_pad - chip_h
    c.setFillColor(SOFT)
    c.setStrokeColor(SOFT)
    c.roundRect(x + inner_pad, chip_y, chip_w, chip_h, 8, fill=1, stroke=0)

    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(ACCENT)
    c.drawString(x + inner_pad + 8, chip_y + 4.2, title)

    text_y = chip_y - chip_gap - body_size
    c.setFont(body_font, body_size)
    c.setFillColor(TEXT)

    for line in body_lines:
        c.drawString(x + inner_pad, text_y, line)
        text_y -= leading

    return y - 10


def make_bullets(items, width, font_name="Helvetica", font_size=9.2, indent=10):
    lines = []
    bullet_width = width - indent
    for item in items:
        wrapped = wrap_text(item, font_name, font_size, bullet_width)
        for index, line in enumerate(wrapped):
            prefix = "- " if index == 0 else "  "
            lines.append(f"{prefix}{line}")
    return lines


def make_paragraph(text, width, font_name="Helvetica", font_size=9.2):
    return wrap_text(text, font_name, font_size, width)


def main():
    repo_root = Path(__file__).resolve().parents[2]
    output_path = repo_root / "output" / "pdf" / "armands-blog-app-summary.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    c = canvas.Canvas(str(output_path), pagesize=LETTER)
    c.setTitle("Armand's Blog - App Summary")
    c.setAuthor("OpenAI Codex")
    c.setSubject("One-page repo summary based on repo evidence")

    c.setFillColor(BG)
    c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)

    x_left = MARGIN
    x_right = MARGIN + LEFT_COL_W + GUTTER
    y_top = PAGE_HEIGHT - MARGIN

    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 23)
    c.drawString(MARGIN, y_top, "Armand's Blog")

    c.setFont("Helvetica", 10.2)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, y_top - 16, "One-page app summary based only on repo evidence")

    c.setStrokeColor(LINE)
    c.line(MARGIN, y_top - 26, PAGE_WIDTH - MARGIN, y_top - 26)

    left_y = y_top - 42
    right_y = y_top - 42

    what_it_is = (
        "A webpack-built static personal site for Armand that combines a profile-led "
        "home page, standalone article pages, and featured project links. The browser "
        "UI adds client-side theming, motion, and hover polish without a backend."
    )
    who_its_for = (
        "Visitors who want a quick introduction to Armand, his writing, and the projects "
        "he wants to surface."
    )
    feature_items = [
        "Single-page home layout with hero, intro, articles, and works sections.",
        "Profile card, status lines, and footer year rendered in the browser.",
        "Three standalone article pages under /articles/ sharing the main site styling.",
        "Featured work cards that link out to external GitHub repositories.",
        "Light/dark theme toggle with preference persisted in localStorage.",
        "Scroll reveal, staggered headline text, and pointer-reactive hover motion.",
        "Static deployment assets including icons, manifest, and copied images/content.",
    ]

    architecture_items = [
        "UI layer: index.html and article HTML files define the static content structure; css/style.css provides the shared visual system and responsive layout.",
        "Client logic: js/app.js sets the footer year, sticky-header state, IntersectionObserver reveals, theme toggle + storage, staggered text, and pointer hover transforms.",
        "Build path: webpack.common.js uses js/app.js as the entry; webpack.config.dev.js serves the project root with webpack-dev-server; webpack.config.prod.js outputs dist/, generates index.html, and copies articles, CSS, images, JS vendor files, icons, robots.txt, and the manifest.",
        "Data/services: Backend, API, database, and CMS are Not found in repo. Content is stored directly in HTML files and static assets.",
    ]
    run_items = [
        "Run npm install.",
        "Start local development with npm start.",
        "Create a production build with npm run build.",
    ]

    left_y = draw_box(
        c,
        x_left,
        left_y,
        LEFT_COL_W,
        "WHAT IT IS",
        make_paragraph(what_it_is, LEFT_COL_W - 22),
    )
    left_y = draw_box(
        c,
        x_left,
        left_y,
        LEFT_COL_W,
        "WHO IT'S FOR",
        make_paragraph(who_its_for, LEFT_COL_W - 22),
    )
    left_y = draw_box(
        c,
        x_left,
        left_y,
        LEFT_COL_W,
        "WHAT IT DOES",
        make_bullets(feature_items, LEFT_COL_W - 22),
        body_size=8.9,
        leading=11.0,
    )

    right_y = draw_box(
        c,
        x_right,
        right_y,
        RIGHT_COL_W,
        "HOW IT WORKS",
        make_bullets(architecture_items, RIGHT_COL_W - 22, font_size=8.7),
        body_size=8.7,
        leading=10.6,
    )
    right_y = draw_box(
        c,
        x_right,
        right_y,
        RIGHT_COL_W,
        "HOW TO RUN",
        make_bullets(run_items, RIGHT_COL_W - 22),
    )
    right_y = draw_box(
        c,
        x_right,
        right_y,
        RIGHT_COL_W,
        "EVIDENCE NOTES",
        make_bullets(
            [
                "Build verified locally with npm run build.",
                "Populated package metadata such as name, description, and author: Not found in repo.",
            ],
            RIGHT_COL_W - 22,
            font_size=8.8,
        ),
        body_size=8.8,
        leading=10.8,
    )

    footer_y = 26
    c.setStrokeColor(LINE)
    c.line(MARGIN, footer_y + 10, PAGE_WIDTH - MARGIN, footer_y + 10)
    c.setFont("Helvetica", 8.2)
    c.setFillColor(MUTED)
    c.drawString(
        MARGIN,
        footer_y,
        "Evidence used: package.json, webpack.common.js, webpack.config.dev.js, "
        "webpack.config.prod.js, index.html, js/app.js, css/style.css, articles/*.html",
    )

    c.showPage()
    c.save()
    print(output_path)


if __name__ == "__main__":
    main()
