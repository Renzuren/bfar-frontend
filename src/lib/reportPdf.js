// src/lib/reportPdf.js
// ============================================================
// "Download PDF" for the Narrative Report: builds the PDF directly with jsPDF
// from the report's content -- real text, not a screenshot -- and downloads it.
//
// Earlier screenshot-based exports (html2canvas) failed on real reports: canvas
// size limits, tiny text, gaps, lines cut in half and whole sections missing;
// the print-dialog route needs a printer/"Save as PDF" step. Here the report DOM
// is walked in order and written out:
//   - headings, paragraphs, captions and list items as wrapped text that flows
//     across pages line by line (styles taken from the page: size, weight, colour,
//     alignment);
//   - tables as drawn tables whose rows continue onto the next page;
//   - each chart <svg> converted on its own to an image (small, so no size limits);
//   - anything else with text falls back to plain paragraphs, so nothing is lost.
// jsPDF's built-in Helvetica only covers Latin-1/WinAnsi, so a few symbols are
// spelled out (see toPdfText).
// ============================================================

const MARGIN_MM = 15;
const LINE_HEIGHT = 1.45;
const PT_TO_MM = 25.4 / 72;
const MAX_GAP_MM = 8;
const KEEP_WITH_HEADING_MM = 22;

// Characters Helvetica (WinAnsi) can't draw -> readable replacements; any other
// character outside WinAnsi becomes '?'.
const REPLACEMENTS = {
  '₱': 'PHP ', '≤': '<=', '≥': '>=', '−': '-', '‐': '-', '‑': '-',
  ' ': ' ', ' ': ' ', '​': '', '→': '->', '←': '<-', '↑': '^', '↓': 'v',
  '✓': 'v', '✕': 'x', '✗': 'x', '±': '+/-',
};
const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
export const toPdfText = (text) => Array.from(String(text ?? '')).map((ch) => {
  if (REPLACEMENTS[ch] !== undefined) return REPLACEMENTS[ch];
  const code = ch.codePointAt(0);
  if (code <= 0xFF || WINANSI_EXTRA.has(ch)) return ch;
  return '?';
}).join('');

const parseColor = (css) => {
  const value = String(css || '').trim();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return [0, 0, 0];
  const [r, g, b, a] = m[1].split(',').map((v) => parseFloat(v));
  if (a === 0) return null;
  return [r, g, b];
};
const isVisible = (el) => {
  if (!(el instanceof window.Element)) return false;
  const cs = window.getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};
const hasOwnText = (el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
const BLOCKISH = new Set(['block', 'flex', 'grid', 'table', 'list-item', 'flow-root', 'table-row', 'table-row-group']);
// True when everything inside `el` is inline text (so it is one paragraph).
const isTextLeaf = (el) => Array.from(el.querySelectorAll('*')).every((child) => {
  if (/^(svg|table|img|canvas|ol|ul|figure)$/i.test(child.tagName)) return false;
  return !BLOCKISH.has(window.getComputedStyle(child).display);
});
const cleanText = (el) => (el.innerText || el.textContent || '').replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

export const buildReportPdf = async (root, { JsPdf }) => {
  const pdf = new JsPdf({ unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const left = MARGIN_MM;
  const width = pageW - MARGIN_MM * 2;
  const bottom = pageH - MARGIN_MM - 6; // room for the page number
  const rootStyle = window.getComputedStyle(root);
  const contentPx = root.getBoundingClientRect().width
    - parseFloat(rootStyle.paddingLeft || 0) - parseFloat(rootStyle.paddingRight || 0);
  const mmPerPx = width / contentPx;
  let y = MARGIN_MM;
  let lastBottomPx = null; // bottom of the previous written element, for spacing

  const newPage = () => { pdf.addPage(); y = MARGIN_MM; };
  const ensure = (mm) => { if (y + mm > bottom && y > MARGIN_MM) newPage(); };
  const gapBefore = (el) => {
    const top = el.getBoundingClientRect().top;
    const gap = lastBottomPx === null ? 0 : Math.max(0, top - lastBottomPx) * mmPerPx;
    return Math.min(MAX_GAP_MM, gap);
  };
  const markWritten = (el) => { lastBottomPx = el.getBoundingClientRect().bottom; };
  const fontFor = (cs) => {
    const bold = parseInt(cs.fontWeight, 10) >= 600;
    const italic = cs.fontStyle === 'italic';
    return bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
  };
  const sizePt = (cs) => Math.max(6, parseFloat(cs.fontSize) * 0.75);

  // Wrapped text, flowing across pages line by line.
  const writeText = (text, el, { prefix = '', keepWithMm = 0 } = {}) => {
    const cs = window.getComputedStyle(el);
    const size = sizePt(cs);
    const str = toPdfText(prefix + text);
    if (!str.trim()) return;
    pdf.setFont('helvetica', fontFor(cs));
    pdf.setFontSize(size);
    const color = parseColor(cs.color) || [0, 0, 0];
    pdf.setTextColor(...color);
    const lineH = size * PT_TO_MM * LINE_HEIGHT;
    const lines = pdf.splitTextToSize(str, width);
    y += y > MARGIN_MM ? gapBefore(el) : 0;
    // Start on a new page if not even two lines (plus anything that must follow) fit.
    ensure(Math.min(lines.length, 2) * lineH + keepWithMm);
    const align = cs.textAlign === 'center' ? 'center' : cs.textAlign === 'right' ? 'right' : cs.textAlign === 'justify' ? 'justify' : 'left';
    lines.forEach((line, i) => {
      if (y + lineH > bottom) newPage();
      const last = i === lines.length - 1;
      if (align === 'center') pdf.text(line, left + width / 2, y, { align: 'center', baseline: 'top' });
      else if (align === 'right') pdf.text(line, left + width, y, { align: 'right', baseline: 'top' });
      else if (align === 'justify' && !last) pdf.text(line, left, y, { align: 'justify', maxWidth: width, baseline: 'top' });
      else pdf.text(line, left, y, { baseline: 'top' });
      y += lineH;
    });
    // Underlined headings (e.g. "1.0 INTRODUCTION" has a rule under it).
    const border = parseFloat(cs.borderBottomWidth) || parseFloat(window.getComputedStyle(el.parentElement).borderBottomWidth);
    if (/^H[1-3]$/.test(el.tagName) && border >= 1) {
      pdf.setDrawColor(30, 41, 59);
      pdf.setLineWidth(0.5);
      pdf.line(left, y + 1, left + width, y + 1);
      y += 3;
    }
    markWritten(el);
  };

  // Chart: the <svg> drawn by the browser onto a canvas, added as one image.
  const writeSvg = async (svg, { keepWithMm = 0 } = {}) => {
    const rect = svg.getBoundingClientRect();
    const w = Math.min(width, rect.width * mmPerPx);
    const h = (rect.height / rect.width) * w;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', rect.width);
    clone.setAttribute('height', rect.height);
    const data = new window.XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('chart could not be drawn'));
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(rect.width * 2);
      canvas.height = Math.round(rect.height * 2);
      const c = canvas.getContext('2d');
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.drawImage(img, 0, 0, canvas.width, canvas.height);
      y += y > MARGIN_MM ? gapBefore(svg) : 0;
      ensure(h + keepWithMm);
      // JPEG is embedded compressed as-is; PNG is stored uncompressed by jsPDF
      // (~4 MB per chart -> a ~500 MB PDF for a 102-figure report).
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', left + (width - w) / 2, y, w, h);
      y += h;
    } finally {
      URL.revokeObjectURL(url);
    }
    markWritten(svg);
  };

  // Chart legend (recharts renders it as HTML): "■ Beneficiary   ■ Non-Beneficiary".
  const writeLegend = (wrapper) => {
    const items = Array.from(wrapper.querySelectorAll('li')).map((li) => {
      const path = li.querySelector('path, rect');
      const fill = path ? (path.getAttribute('fill') || window.getComputedStyle(path).fill) : null;
      return { text: toPdfText(cleanText(li)), color: parseColor(fill) || parseColor(window.getComputedStyle(li).color) || [0, 0, 0] };
    }).filter((item) => item.text);
    if (!items.length) return;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    const total = items.reduce((sum, item) => sum + 4 + pdf.getTextWidth(item.text) + 6, 0);
    let x = left + Math.max(0, (width - total) / 2);
    ensure(6);
    items.forEach((item) => {
      pdf.setFillColor(...item.color);
      pdf.rect(x, y + 0.8, 2.6, 2.6, 'F');
      pdf.setTextColor(71, 85, 105);
      pdf.text(item.text, x + 4, y, { baseline: 'top' });
      x += 4 + pdf.getTextWidth(item.text) + 6;
    });
    y += 5;
    markWritten(wrapper);
  };

  // Table with borders; column widths follow the page's; rows continue on new
  // pages with the header row repeated.
  const writeTable = (table) => {
    const rows = Array.from(table.rows).filter(isVisible);
    if (!rows.length) return;
    const tableRect = table.getBoundingClientRect();
    const scale = Math.min(width / (tableRect.width * mmPerPx), 1) * mmPerPx;
    const header = rows[0].parentElement.tagName === 'THEAD' || Array.from(rows[0].cells).every((c) => c.tagName === 'TH') ? rows[0] : null;
    const pad = 1.5;
    const layoutRow = (row) => {
      let x = left;
      const cells = Array.from(row.cells).map((cell) => {
        const cs = window.getComputedStyle(cell);
        const size = Math.min(sizePt(cs), 10);
        const cw = cell.getBoundingClientRect().width * scale;
        pdf.setFont('helvetica', fontFor(cs));
        pdf.setFontSize(size);
        const lines = pdf.splitTextToSize(toPdfText(cleanText(cell)), Math.max(4, cw - pad * 2));
        const out = { x, w: cw, lines, size, font: fontFor(cs), color: parseColor(cs.color) || [0, 0, 0], bg: parseColor(cs.backgroundColor) || parseColor(window.getComputedStyle(row).backgroundColor), align: cs.textAlign };
        x += cw;
        return out;
      });
      const h = Math.max(...cells.map((c) => c.lines.length * c.size * PT_TO_MM * 1.3)) + pad * 2;
      return { cells, h };
    };
    const drawRow = ({ cells, h }) => {
      cells.forEach((c) => {
        if (c.bg) { pdf.setFillColor(...c.bg); pdf.rect(c.x, y, c.w, h, 'F'); }
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.2);
        pdf.rect(c.x, y, c.w, h, 'S');
        pdf.setFont('helvetica', c.font);
        pdf.setFontSize(c.size);
        pdf.setTextColor(...c.color);
        c.lines.forEach((line, i) => {
          const ty = y + pad + i * c.size * PT_TO_MM * 1.3;
          if (c.align === 'center') pdf.text(line, c.x + c.w / 2, ty, { align: 'center', baseline: 'top' });
          else if (c.align === 'right') pdf.text(line, c.x + c.w - pad, ty, { align: 'right', baseline: 'top' });
          else pdf.text(line, c.x + pad, ty, { baseline: 'top' });
        });
      });
      y += h;
    };
    y += y > MARGIN_MM ? gapBefore(table) : 0;
    const headerLayout = header ? layoutRow(header) : null;
    const laid = rows.map((row) => (row === header ? headerLayout : layoutRow(row)));
    ensure((headerLayout ? headerLayout.h : 0) + (laid[header ? 1 : 0]?.h || 0));
    laid.forEach((row, i) => {
      if (y + row.h > bottom) {
        newPage();
        if (headerLayout && rows[i] !== header) drawRow(headerLayout);
      }
      drawRow(row);
    });
    markWritten(table);
  };

  const writeList = async (list) => {
    const items = Array.from(list.children).filter((li) => li.tagName === 'LI' && isVisible(li));
    for (let i = 0; i < items.length; i += 1) {
      const li = items[i];
      const type = window.getComputedStyle(li).listStyleType;
      const prefix = type === 'decimal' ? `${i + 1}. ` : /disc|circle|square/.test(type) ? '• ' : '';
      // eslint-disable-next-line no-await-in-loop
      if (li.querySelector('table, svg, figure')) await walkChildren(li);
      else writeText(cleanText(li), li, { prefix });
    }
    markWritten(list);
  };

  // Height (mm) of the next sibling that contains a chart, so a caption stays with it.
  const followingChartMm = (el) => {
    const next = el.nextElementSibling;
    if (!next || !next.querySelector('svg')) return 0;
    return Math.min(140, next.getBoundingClientRect().height * mmPerPx);
  };

  const walk = async (el) => {
    if (!isVisible(el) || el.classList.contains('no-print') || el.classList.contains('recharts-tooltip-wrapper')) return;
    const tag = el.tagName.toUpperCase();
    if (el.classList.contains('recharts-legend-wrapper')) { writeLegend(el); return; }
    if (tag === 'SVG') { await writeSvg(el); return; }
    if (tag === 'TABLE') { writeTable(el); return; }
    if (tag === 'OL' || tag === 'UL') { await writeList(el); return; }
    if (/^H[1-6]$/.test(tag)) { writeText(cleanText(el), el, { keepWithMm: KEEP_WITH_HEADING_MM }); return; }
    if (tag === 'FIGCAPTION') { writeText(cleanText(el), el, { keepWithMm: followingChartMm(el) }); return; }
    if (hasOwnText(el) || isTextLeaf(el)) { writeText(cleanText(el), el); return; }
    await walkChildren(el);
  };
  const walkChildren = async (el) => {
    for (const child of Array.from(el.children)) {
      // eslint-disable-next-line no-await-in-loop
      await walk(child);
    }
  };

  await walkChildren(root);

  // Page numbers.
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Page ${p} of ${pages}`, pageW / 2, pageH - MARGIN_MM + 2, { align: 'center', baseline: 'top' });
  }
  return pdf;
};
