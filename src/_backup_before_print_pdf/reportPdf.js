// src/lib/reportPdf.js
// ============================================================
// "Download PDF" for long HTML reports (the Narrative Report).
//
// Capturing a whole report as ONE html2canvas image fails once it is taller
// than the browser's canvas limit (~32k px): with 87+ figures the 2x image is
// 117k-137k px tall and comes out empty ("Failed to generate PDF"). Even when
// it fit, re-embedding that full image on every page made a ~350 MB file.
//
// Instead the report is flowed onto A4 pages piece by piece, like text:
//   - pieces are the report's blocks (headings, text blocks, whole figures);
//   - a piece that doesn't fit in the space left on a page is split right there
//     into its parts (a figure into caption+chart / table / text, a text block
//     into paragraphs, a long table into rows), so pages fill up instead of
//     leaving large gaps -- and pieces that fit stay whole (fewer captures);
//   - headings and figure captions stay with what follows them;
//   - a single piece that still can't fit (e.g. one paragraph taller than a
//     page) is cut at a blank line between rows of text, never through one.
// ============================================================

const MARGIN_MM = 12;
const MAX_GAP_MM = 6;
// Space kept with a heading when what follows it can be split (or is taller than
// a page), and the least space worth splitting a piece into (below it: new page).
const KEEP_WITH_HEADING_MM = 40;
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
const visibleChildren = (el) => Array.from(el.children).filter(isVisible);
// Parents whose other children must stay in place when one child is captured:
// list items keep their numbering, table rows keep the table's column widths.
const keepsSiblings = (el) => Boolean(el) && /^(OL|UL|TABLE|THEAD|TBODY|TFOOT)$/.test(el.tagName);
const piece = (el, keepWithNext = false) => ({ el, keepWithNext: keepWithNext || isHeadingEl(el) });

/**
 * The parts `el` can be split into when it doesn't fit on the current page, or
 * null if it must stay whole: a figure splits into its children (caption kept
 * with the chart after it); a container with no text of its own splits into its
 * children; charts/images never split.
 */
export const splitPiece = (el) => {
  if (el.tagName === 'FIGURE') {
    const kids = visibleChildren(el);
    return kids.length > 1 ? kids.map((kid, i) => piece(kid, i === 0 && kid.tagName === 'FIGCAPTION')) : null;
  }
  if (hasOwnText(el) || el.querySelector('svg, canvas, img')) return null;
  const kids = visibleChildren(el);
  if (kids.length > 1) return kids.map((kid) => piece(kid));
  if (kids.length === 1) return splitPiece(kids[0]);
  return null;
};

/**
 * The report's top-level pieces, in order, as { el, keepWithNext }: every child
 * of each <section> (and root's other children), with any container of <figure>s
 * opened so each figure starts as its own piece.
 */
export const collectPdfBlocks = (root) => {
  const blocks = [];
  const visit = (el) => {
    if (!isVisible(el)) return;
    if (el.tagName !== 'FIGURE' && !hasOwnText(el) && el.querySelector('figure')) {
      visibleChildren(el).forEach(visit);
      return;
    }
    blocks.push(piece(el));
  };
  Array.from(root.children).forEach((child) => {
    if (child.tagName === 'SECTION') Array.from(child.children).forEach(visit);
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
 * Renders `root` into an A4 jsPDF document. `html2canvas` and `JsPdf` are passed
 * in (the page imports them). `onProgress(done, total)` is called as pieces are
 * placed (the total can grow as pieces are split). Returns the jsPDF document.
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
  const heightMm = (el) => el.getBoundingClientRect().height * mmPerPx;

  const queue = collectPdfBlocks(root);
  let y = MARGIN_MM;
  let previousEl = null;

  for (let i = 0; i < queue.length; i += 1) {
    const { el, keepWithNext } = queue[i];
    const rect = el.getBoundingClientRect();
    const estH = rect.height * mmPerPx;
    const gap = previousEl
      ? Math.min(MAX_GAP_MM, Math.max(0, rect.top - previousEl.getBoundingClientRect().bottom) * mmPerPx)
      : 0;
    const room = bottom - (y > MARGIN_MM ? y + gap : y);

    // Doesn't fit in the space left (but a useful amount is left): split it here.
    if (estH > room && room >= KEEP_WITH_HEADING_MM) {
      const parts = splitPiece(el);
      if (parts) {
        queue.splice(i, 1, ...parts);
        i -= 1;
        continue;
      }
    }

    // A heading or figure caption moves to the next page together with what
    // follows it: any further headings right after it, plus the next piece -- all
    // of it if that can't be split and fits on a page, else its first few
    // centimetres. Each following piece also brings up to MAX_GAP_MM of spacing.
    let needed = estH;
    if (keepWithNext) {
      let j = i + 1;
      while (j < queue.length && queue[j].keepWithNext) {
        needed += MAX_GAP_MM + heightMm(queue[j].el);
        j += 1;
      }
      if (j < queue.length) {
        const nextH = heightMm(queue[j].el);
        needed += MAX_GAP_MM + (nextH <= pageSpace && !splitPiece(queue[j].el) ? nextH : Math.min(nextH, KEEP_WITH_HEADING_MM));
      }
    } else if (estH > pageSpace) {
      // Split across pages anyway: start it here unless little room is left.
      needed = KEEP_WITH_HEADING_MM;
    }
    if (y > MARGIN_MM && y + gap + needed > bottom) {
      pdf.addPage();
      y = MARGIN_MM;
    } else if (y > MARGIN_MM) {
      y += gap;
    }

    // Let the page repaint so the progress label updates during long exports.
    await new Promise((resolve) => setTimeout(resolve, 0));
    // html2canvas clones the whole document for every capture; skipping everything
    // that isn't this piece or one of its ancestors keeps each clone small (without
    // it a 102-figure report took ~170 s instead of seconds). The other items of a
    // list or rows of a table are kept, so a list item still shows its own number
    // (2., 3., ...) and a table row keeps the table's column widths.
    const keepScope = (el.parentElement && el.parentElement.closest('table'))
      || (keepsSiblings(el.parentElement) ? el.parentElement : null);
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      ignoreElements: (node) => document.body.contains(node)
        && !node.contains(el) && !el.contains(node)
        && !(keepScope && keepScope.contains(node)),
    });
    const x = MARGIN_MM + Math.max(0, rect.left - contentLeft) * mmPerPx;
    const w = rect.width * mmPerPx;
    const h = (canvas.height * w) / canvas.width;

    if (y + h <= bottom + 0.01) {
      pdf.addImage(canvas.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', x, y, w, h);
      y += h;
    } else {
      // Still taller than the space left: split into strips, each cut at a blank line.
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
    previousEl = el;
    if (onProgress) onProgress(i + 1, queue.length);
  }
  return pdf;
};
