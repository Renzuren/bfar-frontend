// src/lib/reportPdf.js
// ============================================================
// "Download PDF" for long HTML reports (the Narrative Report).
//
// Capturing a whole report as ONE html2canvas image fails once it is taller
// than the browser's canvas limit (~32k px): with 87+ figures the 2x image is
// 117k-137k px tall and comes out empty ("Failed to generate PDF"). Even when
// it fit, re-embedding that full image on every page made a ~350 MB file.
//
// Instead the report is cut into small pieces -- headings, paragraphs, list
// items, figure captions, charts, tables -- each captured on its own and flowed
// onto A4 pages like text: a piece that doesn't fit starts a new page, headings
// and figure captions stay with what follows them, and pieces stay small enough
// that pages fill up instead of leaving large gaps. Only a single piece taller
// than the space left is split, and then at a blank line so no text is cut through.
// ============================================================

const MARGIN_MM = 12;
const MAX_GAP_MM = 6;
// Content kept with a heading when what follows it is taller than a page, and the
// least space worth starting such a piece in (below this it starts a new page).
const KEEP_WITH_HEADING_MM = 40;
// A container taller than this share of a page is split into its children.
const MAX_PIECE_PAGE_SHARE = 0.2;
const JPEG_QUALITY = 0.92;
// The report is laid out at this width while it is captured, so the PDF looks the
// same on any screen. At the report's full screen width, 14px body text printed at
// ~5 pt on a 1600px-wide screen; at 820px it prints at roughly 10-11 pt.
const PRINT_WIDTH_PX = 820;
const LAYOUT_SETTLE_MS = 600;

// Waits for the browser to re-lay-out (and for responsive charts, which re-measure
// with a ResizeObserver, to redraw) after the report's width changes.
const waitForLayout = () => new Promise((resolve) => {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => setTimeout(resolve, LAYOUT_SETTLE_MS)));
});

const isHeadingEl = (el) =>
  /^H[1-6]$/.test(el.tagName) || (el.children.length === 1 && /^H[1-6]$/.test(el.children[0].tagName));
const isVisible = (el) => el.offsetHeight > 0 && el.offsetWidth > 0;
const hasOwnText = (el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
// Parents whose other children must stay in place when one child is captured:
// list items keep their numbering, table rows keep the table's column widths.
const keepsSiblings = (el) => Boolean(el) && /^(OL|UL|TABLE|THEAD|TBODY|TFOOT)$/.test(el.tagName);

/**
 * The pieces of `root` to capture, in order, as { el, keepWithNext }:
 *   - containers holding <figure>s are opened, and every figure is split into
 *     its parts (its caption kept with the chart that follows it);
 *   - any other container taller than `maxPiecePx` is split into its children
 *     (paragraphs, list items), unless it has text of its own;
 *   - a table is split into rows only when taller than `maxTablePx` (a page):
 *     each captured row costs a capture of the whole table.
 */
export const collectPdfBlocks = (root, maxPiecePx = Infinity, maxTablePx = Infinity) => {
  const blocks = [];
  const visit = (el, keepWithNext = false) => {
    if (!isVisible(el)) return;
    const kids = Array.from(el.children).filter(isVisible);
    if (el.tagName === 'FIGURE') {
      kids.forEach((kid, i) => visit(kid, i === 0 && kid.tagName === 'FIGCAPTION'));
      return;
    }
    const height = el.getBoundingClientRect().height;
    const isTablePart = /^(TABLE|THEAD|TBODY|TFOOT)$/.test(el.tagName);
    const opens = kids.length > 0 && !hasOwnText(el) && (
      el.querySelector('figure') !== null
      || (isTablePart ? height > maxTablePx : kids.length > 1 && height > maxPiecePx)
    );
    if (opens) {
      kids.forEach((kid) => visit(kid));
      return;
    }
    blocks.push({ el, keepWithNext: keepWithNext || isHeadingEl(el) });
  };
  Array.from(root.children).forEach((child) => {
    if (child.tagName === 'SECTION') Array.from(child.children).forEach((kid) => visit(kid));
    else visit(child);
  });
  return blocks;
};

// Row (in canvas px) between `minEnd` and `idealEnd` where the image is blank
// across its whole width -- the gap between two lines of text -- so a cut there
// doesn't go through a line. Searches upward from `idealEnd`; falls back to it.
const findBlankRow = (canvas, minEnd, idealEnd) => {
  const top = Math.max(0, Math.floor(minEnd));
  const height = Math.max(1, Math.floor(idealEnd) - top);
  const data = canvas.getContext('2d').getImageData(0, top, canvas.width, height).data;
  for (let row = height - 1; row >= 0; row -= 1) {
    let blank = true;
    for (let x = 0; x < canvas.width; x += 3) {
      const k = (row * canvas.width + x) * 4;
      if (data[k] < 235 || data[k + 1] < 235 || data[k + 2] < 235) { blank = false; break; }
    }
    if (blank) return top + row + 1;
  }
  return Math.floor(idealEnd);
};

/**
 * Renders `root` into an A4 jsPDF document, piece by piece. `html2canvas` and
 * `JsPdf` are passed in (the page imports them). `onProgress(done, total)` is
 * called after each piece. Returns the jsPDF document.
 */
export const renderReportPdf = async ({ root, html2canvas, JsPdf, onProgress }) => {
  const previous = { width: root.style.width, maxWidth: root.style.maxWidth };
  root.style.width = `${PRINT_WIDTH_PX}px`;
  root.style.maxWidth = `${PRINT_WIDTH_PX}px`;
  try {
    await waitForLayout();
    return await layOutPdf({ root, html2canvas, JsPdf, onProgress });
  } finally {
    root.style.width = previous.width;
    root.style.maxWidth = previous.maxWidth;
  }
};

const layOutPdf = async ({ root, html2canvas, JsPdf, onProgress }) => {
  const pdf = new JsPdf('p', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const usableW = pageW - MARGIN_MM * 2;
  const bottom = pageH - MARGIN_MM;
  const pageSpace = bottom - MARGIN_MM;

  // Map the report's content box (inside its padding) onto the page's usable width.
  const rootRect = root.getBoundingClientRect();
  const style = window.getComputedStyle(root);
  const contentLeft = rootRect.left + parseFloat(style.paddingLeft || 0);
  const contentWidth = rootRect.width - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
  const mmPerPx = usableW / contentWidth;

  const blocks = collectPdfBlocks(root, (pageSpace * MAX_PIECE_PAGE_SHARE) / mmPerPx, pageSpace / mmPerPx);
  const rects = blocks.map(({ el }) => el.getBoundingClientRect());
  let y = MARGIN_MM;

  for (let i = 0; i < blocks.length; i += 1) {
    const { el, keepWithNext } = blocks[i];
    const rect = rects[i];
    // Let the page repaint so the progress label updates during long exports.
    await new Promise((resolve) => setTimeout(resolve, 0));
    // html2canvas clones the whole document for every capture; skipping everything
    // that isn't this piece or one of its ancestors keeps each clone small (without
    // it a 102-figure report took ~170 s instead of seconds). The other items of a
    // list or rows of a table are kept, so a list item still shows its own number
    // (2., 3., ...) and a table row keeps the table's column widths.
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      ignoreElements: (node) => document.body.contains(node)
        && !node.contains(el) && !el.contains(node)
        && !(keepsSiblings(el.parentElement) && el.parentElement.contains(node)),
    });
    const x = MARGIN_MM + Math.max(0, rect.left - contentLeft) * mmPerPx;
    const w = rect.width * mmPerPx;
    const h = (canvas.height * w) / canvas.width;
    const gap = i > 0 ? Math.min(MAX_GAP_MM, Math.max(0, rect.top - rects[i - 1].bottom) * mmPerPx) : 0;

    // A heading or figure caption moves to the next page together with what
    // follows it: any further headings right after it, plus the next piece (all
    // of it if it fits on a page, else its first few centimetres). Each following
    // piece also brings up to MAX_GAP_MM of spacing.
    let needed = h;
    if (keepWithNext) {
      let j = i + 1;
      while (j < blocks.length && blocks[j].keepWithNext) {
        needed += MAX_GAP_MM + rects[j].height * mmPerPx;
        j += 1;
      }
      const contentH = j < blocks.length ? rects[j].height * mmPerPx : 0;
      if (j < blocks.length) needed += MAX_GAP_MM + (contentH <= pageSpace ? contentH : KEEP_WITH_HEADING_MM);
    } else if (h > pageSpace) {
      // Split across pages anyway: start it here unless little room is left.
      needed = KEEP_WITH_HEADING_MM;
    }
    if (y > MARGIN_MM && y + gap + needed > bottom) {
      pdf.addPage();
      y = MARGIN_MM;
    } else if (y > MARGIN_MM) {
      y += gap;
    }

    if (y + h <= bottom + 0.01) {
      pdf.addImage(canvas.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', x, y, w, h);
      y += h;
    } else {
      // Taller than the space left: split into strips, each cut at a blank line.
      const pxPerMm = canvas.width / w;
      let offsetPx = 0;
      while (offsetPx < canvas.height) {
        const roomPx = (bottom - y) * pxPerMm;
        let endPx = Math.min(canvas.height, offsetPx + roomPx);
        if (endPx < canvas.height) {
          // Look back up to a third of the strip for a blank row to cut at.
          endPx = findBlankRow(canvas, offsetPx + roomPx * 0.66, endPx);
        }
        const slicePx = Math.max(1, Math.round(endPx - offsetPx));
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = slicePx;
        slice.getContext('2d').drawImage(canvas, 0, offsetPx, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
        pdf.addImage(slice.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', x, y, w, slicePx / pxPerMm);
        offsetPx += slicePx;
        y += slicePx / pxPerMm;
        if (offsetPx < canvas.height) {
          pdf.addPage();
          y = MARGIN_MM;
        }
      }
    }
    if (onProgress) onProgress(i + 1, blocks.length);
  }
  return pdf;
};
