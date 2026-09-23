// src/lib/printReport.js
// ============================================================
// "Download PDF" for the Narrative Report via the browser's own print engine
// (Print -> "Save as PDF"). Screenshot-based export (html2canvas + jsPDF) kept
// failing on real reports: canvas size limits, tiny text, gaps, cut lines and
// whole sections missing. Printing gives the complete report with real,
// selectable text and proper page breaks (rules in index.css, "PRINT").
//
// Before printing, the report is laid out at the A4 content width so charts
// (which size themselves to their container) redraw to fit the page, then a copy
// is placed in a print-only container directly under <body>, so nothing else on
// the page (sidebar, toolbars) can affect the printed layout.
// ============================================================

// A4 (210 mm) minus the 12 mm @page margins on each side = 186 mm = ~703 CSS px.
export const PRINT_CONTENT_WIDTH_PX = 703;
const LAYOUT_SETTLE_MS = 600;
const PORTAL_ID = 'report-print-portal';
const BODY_CLASS = 'printing-report';

// Waits for the browser to re-lay-out (and responsive charts, which re-measure
// with a ResizeObserver, to redraw) after the report's width changes.
const waitForLayout = () => new Promise((resolve) => {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => setTimeout(resolve, LAYOUT_SETTLE_MS)));
});

/**
 * Prepares `root` for printing and returns a cleanup function that undoes it:
 * lays it out at the print width, copies it into the print-only container and
 * sets the document title (Chrome suggests it as the PDF's file name).
 */
export const preparePrint = async (root, { title } = {}) => {
  const previous = {
    width: root.style.width,
    maxWidth: root.style.maxWidth,
    padding: root.style.padding,
    title: document.title,
  };
  root.style.width = `${PRINT_CONTENT_WIDTH_PX}px`;
  root.style.maxWidth = `${PRINT_CONTENT_WIDTH_PX}px`;
  root.style.padding = '0';
  await waitForLayout();

  document.getElementById(PORTAL_ID)?.remove();
  const portal = document.createElement('div');
  portal.id = PORTAL_ID;
  portal.appendChild(root.cloneNode(true));
  document.body.appendChild(portal);
  document.body.classList.add(BODY_CLASS);
  if (title) document.title = title;

  let done = false;
  return () => {
    if (done) return;
    done = true;
    portal.remove();
    document.body.classList.remove(BODY_CLASS);
    document.title = previous.title;
    root.style.width = previous.width;
    root.style.maxWidth = previous.maxWidth;
    root.style.padding = previous.padding;
  };
};

/**
 * Opens the print dialog for `root` (choose "Save as PDF" as the destination).
 * Resolves once the dialog is closed and the page is restored.
 */
export const printReport = async (root, { title } = {}) => {
  const cleanup = await preparePrint(root, { title });
  const onAfterPrint = () => {
    window.removeEventListener('afterprint', onAfterPrint);
    cleanup();
  };
  window.addEventListener('afterprint', onAfterPrint);
  try {
    window.print(); // blocks until the dialog closes in Chrome/Edge
  } finally {
    // Some browsers return from print() before 'afterprint'; restore shortly after.
    setTimeout(onAfterPrint, 500);
  }
};
