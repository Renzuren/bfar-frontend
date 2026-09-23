// src/lib/reportPdf.js
// ============================================================
// "Download PDF" for long HTML reports (the Narrative Report).
//
// Capturing a whole report as ONE html2canvas image fails once it is taller
// than the browser's canvas limit (~32k px): with 87+ figures the 2x image is
// 117k-137k px tall and comes out empty ("Failed to generate PDF"). Even when
// it fit, re-embedding that full image on every page made a ~350 MB file.
//
// Instead each piece of the report (cover, heading, paragraph group, table,
// each figure) is captured on its own and laid out on A4 pages: a piece that
// doesn't fit starts a new page, headings stay with what follows them, and only
// a piece taller than a whole page is sliced.
// ============================================================

const MARGIN_MM = 12;
const MAX_GAP_MM = 6;
// Content kept with a heading when what follows it is taller than a page, and the
// least space worth starting such a piece in (below this it starts a new page).
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

const isHeading = (el) =>
  /^H[1-6]$/.test(el.tagName) || (el.children.length === 1 && /^H[1-6]$/.test(el.children[0].tagName));

/**
 * The pieces of `root` to capture one at a time: every child of each <section>
 * (and root's other children), descending into any container that holds
 * <figure>s so each figure is its own piece.
 */
export const collectPdfBlocks = (root) => {
  const blocks = [];
  const visit = (el) => {
    if (el.tagName !== 'FIGURE' && el.children.length && el.querySelector('figure')) {
      Array.from(el.children).forEach(visit);
      return;
    }
    blocks.push(el);
  };
  Array.from(root.children).forEach((child) => {
    if (child.tagName === 'SECTION') Array.from(child.children).forEach(visit);
    else visit(child);
  });
  return blocks.filter((el) => el.offsetHeight > 0 && el.offsetWidth > 0);
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

  // Map the report's content box (inside its padding) onto the page's usable width.
  const rootRect = root.getBoundingClientRect();
  const style = window.getComputedStyle(root);
  const contentLeft = rootRect.left + parseFloat(style.paddingLeft || 0);
  const contentWidth = rootRect.width - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
  const mmPerPx = usableW / contentWidth;

  const blocks = collectPdfBlocks(root);
  const rects = blocks.map((el) => el.getBoundingClientRect());
  let y = MARGIN_MM;

  for (let i = 0; i < blocks.length; i += 1) {
    const el = blocks[i];
    const rect = rects[i];
    // Let the page repaint so the progress label updates during long exports.
    await new Promise((resolve) => setTimeout(resolve, 0));
    // html2canvas clones the whole document for every capture; skipping everything
    // that isn't this piece or one of its ancestors keeps each clone small (without
    // it a 102-figure report took ~170 s instead of seconds).
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      ignoreElements: (node) => document.body.contains(node) && !node.contains(el) && !el.contains(node),
    });
    const x = MARGIN_MM + Math.max(0, rect.left - contentLeft) * mmPerPx;
    const w = rect.width * mmPerPx;
    const h = (canvas.height * w) / canvas.width;
    const gap = i > 0 ? Math.min(MAX_GAP_MM, Math.max(0, rect.top - rects[i - 1].bottom) * mmPerPx) : 0;

    // A heading moves to the next page together with what follows it: any further
    // headings right after it, plus the next piece of content (all of it if it fits
    // on a page, else its first few centimetres).
    const pageSpace = bottom - MARGIN_MM;
    let needed = h;
    if (isHeading(el)) {
      let j = i + 1;
      // (each following piece also brings up to MAX_GAP_MM of spacing)
      while (j < blocks.length && isHeading(blocks[j])) {
        needed += MAX_GAP_MM + rects[j].height * mmPerPx;
        j += 1;
      }
      const contentH = j < blocks.length ? rects[j].height * mmPerPx : 0;
      if (j < blocks.length) needed += MAX_GAP_MM + (contentH <= pageSpace ? contentH : KEEP_WITH_HEADING_MM);
    } else if (h > pageSpace) {
      // Sliced across pages anyway: start it here unless little room is left.
      needed = KEEP_WITH_HEADING_MM;
    }
    if (y > MARGIN_MM && y + gap + needed > bottom) {
      pdf.addPage();
      y = MARGIN_MM;
    } else if (y > MARGIN_MM) {
      y += gap;
    }

    if (h <= pageSpace) {
      pdf.addImage(canvas.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', x, y, w, h);
      y += h;
    } else {
      // Taller than a page: slice it into page-height strips.
      const pxPerMm = canvas.width / w;
      let offsetPx = 0;
      while (offsetPx < canvas.height) {
        const sliceMm = bottom - y;
        const slicePx = Math.min(canvas.height - offsetPx, Math.floor(sliceMm * pxPerMm));
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
