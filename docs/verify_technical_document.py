"""Read-only document checks plus local PNG rendering of the Word-exported PDF.

Uses pypdf and pypdfium2. Does not call LibreOffice or access the network.
Run after build_technical_document.py and export_word_pdf.ps1.
"""
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZipFile

from lxml import etree
from pypdf import PdfReader
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parent
PDF = ROOT / "成都猫狗小院-技术文档.pdf"
DOCX = ROOT / "成都猫狗小院-技术文档.docx"
BUILD = ROOT / "build"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def compact(text):
    return re.sub(r"\s+", "", text)


def main():
    reader = PdfReader(PDF)
    texts = [page.extract_text() or "" for page in reader.pages]
    assert 0 < len(texts) <= 30, f"PDF pages: {len(texts)}"
    assert all(text.strip() for text in texts), "Blank PDF page"
    assert all("\ufffd" not in text for text in texts), "Replacement glyph"
    fonts = {}
    for page in reader.pages:
        resources = page["/Resources"].get_object()
        for reference in resources.get("/Font", {}).get_object().values():
            font = reference.get_object()
            descendants = font.get("/DescendantFonts", [font])
            embedded = []
            for descendant in descendants:
                descriptor = descendant.get_object().get("/FontDescriptor")
                embedded.append(bool(descriptor and any(key in descriptor.get_object() for key in ("/FontFile", "/FontFile2", "/FontFile3"))))
            name = str(font.get("/BaseFont", "unknown"))
            fonts[name] = fonts.get(name, True) and all(embedded)
    assert fonts and all(fonts.values()), f"Unembedded fonts: {fonts}"
    with ZipFile(DOCX) as archive:
        document = etree.fromstring(archive.read("word/document.xml"))
        styles_xml = etree.fromstring(archive.read("word/styles.xml"))
    picture_properties = document.xpath("//*[local-name()='docPr']")
    assert len(picture_properties) == 4, f"Picture count: {len(picture_properties)}"
    assert all((picture.get("descr") or "").strip() for picture in picture_properties), "Missing picture alt text"
    heading_styles = {
        style.get(qn) for style in styles_xml
        if style.xpath('./w:pPr/w:outlineLvl[@w:val="0" or @w:val="1"]', namespaces=NS)
        for qn in (f'{{{NS["w"]}}}styleId',)
        if style.xpath('./w:name[starts-with(@w:val, "heading")]', namespaces=NS)
    }
    paragraphs = document.xpath(".//w:body/w:p", namespaces=NS)
    bookmarks = {}
    headings = {}
    toc = []
    for paragraph in paragraphs:
        value = "".join(paragraph.xpath(".//w:t/text()", namespaces=NS))
        styles = paragraph.xpath("./w:pPr/w:pStyle/@w:val", namespaces=NS)
        if styles and styles[0] in heading_styles:
            hits = [index + 1 for index, text in enumerate(texts) if index >= 2 and compact(value) in {compact(line) for line in text.splitlines()}]
            assert hits, f"Heading missing in PDF: {value}"
            headings[value] = hits[0]
            for bookmark in paragraph.xpath(".//w:bookmarkStart/@w:name", namespaces=NS):
                bookmarks[bookmark] = value
        # Descendant selection deliberately includes PAGEREF inside w:hyperlink.
        instruction = " ".join(paragraph.xpath(".//w:instrText/text()", namespaces=NS))
        for match in re.finditer(r"PAGEREF\s+(\S+)", instruction):
            page = re.search(r"(\d+)\s*$", value)
            assert page, f"Missing cached page: {value}"
            toc.append({"bookmark": match.group(1), "cachedPage": int(page.group(1)), "text": value})
    assert len(toc) == len(headings) and len(toc) >= 9, f"TOC counts {len(toc)} vs {len(headings)}"
    for entry in toc:
        assert entry["bookmark"] in bookmarks, entry
        expected = headings[bookmarks[entry["bookmark"]]]
        assert entry["cachedPage"] == expected, f"Stale PAGEREF: {entry}, expected {expected}"
    captions = ["".join(paragraph.xpath(".//w:t/text()", namespaces=NS)) for paragraph in paragraphs]
    sequences = {}
    for kind in ("图", "表"):
        sequences[kind] = [int(match.group(1)) for text in captions if (match := re.match(rf"^{kind}\s+(\d+)\s", text))]
        assert sequences[kind] == [1, 2, 3], sequences
    # The body may legitimately explain that old AI WEB requirements were replaced.
    assert not re.search(r"AI\s*WEB|健康守护", texts[0]), "Old track on cover"
    assert not re.search(r"暂缺|更新目录|Error!|错误!", "\n".join(texts)), "Unresolved field or placeholder"
    for term in ("转场", "抽屉", "按压", "prefers-reduced-motion", "意图控制", "可复现"):
        assert term in "\n".join(texts), term
    BUILD.mkdir(exist_ok=True)
    output = BUILD / "qa-pages-10039"
    output.mkdir(exist_ok=True)
    with pdfium.PdfDocument(PDF) as pdf:
        for index in range(len(pdf)):
            page = pdf[index]
            bitmap = page.render(scale=1.5)
            bitmap.to_pil().save(output / f"page-{index + 1}.png")
            bitmap.close()
            page.close()
    report = {"pages": len(texts), "fonts": fonts, "allFontsEmbedded": True, "tocEntries": len(toc), "headings": headings, "toc": toc, "sequences": sequences, "renderer": "pypdfium2 (PDF rendering only; does not create or update DOCX/PDF)", "pdfProducer": str(reader.metadata.producer or "unknown") if reader.metadata else "unknown", "visualReview": "pending", "sha256": {file.name: hashlib.sha256(file.read_bytes()).hexdigest() for file in (DOCX, PDF)}}
    (BUILD / "document-qa-10039.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    # Windows terminals may use GBK; PDF metadata can contain unsupported glyphs.
    # The saved report stays UTF-8, while the console uses portable JSON escapes.
    print(json.dumps(report, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
