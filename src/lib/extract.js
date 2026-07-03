// Extractor — PDF text layer via pdf.js, OCR fallback via tesseract.js for scans/photos.
// Everything runs in the browser; the document never touches a server we own.

// onProgress({stage, page, pages, note})
async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjsLib;
}

export async function extractFromPdf(file, onProgress) {
  const pdfjsLib = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = pdf.numPages;
  let text = '';
  let charCount = 0;

  for (let i = 1; i <= pages; i++) {
    onProgress?.({ stage: 'pdf-text', page: i, pages });
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => it.str).join(' ');
    charCount += pageText.trim().length;
    text += pageText + '\n\n';
  }

  // Heuristic: if the text layer is nearly empty, it's a scanned PDF — OCR it.
  const avgCharsPerPage = charCount / pages;
  if (avgCharsPerPage < 120) {
    onProgress?.({ stage: 'ocr-start', pages, note: 'No usable text layer — running OCR' });
    return ocrPdfPages(pdf, pages, onProgress);
  }
  return { text: normalize(text), method: 'pdf-text', pages };
}

async function ocrPdfPages(pdf, pages, onProgress) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  let text = '';
  let lowConfidence = false;
  try {
    const maxPages = Math.min(pages, 30); // OCR budget
    for (let i = 1; i <= maxPages; i++) {
      onProgress?.({ stage: 'ocr', page: i, pages: maxPages });
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const { data } = await worker.recognize(canvas);
      if ((data.confidence ?? 100) < 55) lowConfidence = true;
      text += data.text + '\n\n';
    }
    return {
      text: normalize(text),
      method: 'ocr',
      pages,
      truncated: pages > 30 ? pages - 30 : 0,
      lowConfidence,
    };
  } finally {
    await worker.terminate();
  }
}

export async function extractFromImage(file, onProgress) {
  const { createWorker } = await import('tesseract.js');
  onProgress?.({ stage: 'ocr', page: 1, pages: 1 });
  const worker = await createWorker('eng');
  try {
    const { data } = await worker.recognize(file);
    return {
      text: normalize(data.text),
      method: 'ocr',
      pages: 1,
      lowConfidence: (data.confidence ?? 100) < 55,
    };
  } finally {
    await worker.terminate();
  }
}

export async function extract(file, onProgress) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return extractFromPdf(file, onProgress);
  if (file.type.startsWith('image/')) return extractFromImage(file, onProgress);
  if (name.endsWith('.txt') || file.type.startsWith('text/')) {
    const text = await file.text();
    return { text: normalize(text), method: 'text', pages: 1 };
  }
  throw new Error(`Unsupported file type: ${file.name}. Use PDF, image, or plain text.`);
}

function normalize(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
