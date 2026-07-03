// Clause Segmenter — splits contract text into analyzable clauses.
// Heuristic-first: numbered sections, ALL-CAPS headings, paragraph breaks.

const CLAUSE_HEAD = /^(\s*)(\d{1,2}[.)]\s+|\d{1,2}\.\d{1,2}[.)]?\s+|[IVXLC]{1,6}[.)]\s+|[a-z][.)]\s+|(?:ARTICLE|SECTION|CLAUSE)\s+\w+|[A-Z][A-Z\s&/-]{6,}:?\s*$)/;

export function segment(text) {
  const lines = text.split('\n');
  const blocks = [];
  let current = [];

  const flush = () => {
    const body = current.join('\n').trim();
    if (body.length > 40) blocks.push(body);
    current = [];
  };

  for (const line of lines) {
    if (CLAUSE_HEAD.test(line) && current.join(' ').trim().length > 60) {
      flush();
    }
    current.push(line);
  }
  flush();

  // If heuristics found too few blocks (unstructured doc), fall back to paragraph chunks.
  if (blocks.length < 4) {
    const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 60);
    if (paras.length >= blocks.length) {
      return finalize(paras);
    }
  }
  return finalize(blocks);
}

function finalize(blocks) {
  // Merge tiny fragments into neighbors, split monsters (>2200 chars) at sentence boundaries.
  const merged = [];
  for (const b of blocks) {
    if (b.length < 120 && merged.length) merged[merged.length - 1] += '\n' + b;
    else merged.push(b);
  }
  const out = [];
  for (const b of merged) {
    if (b.length <= 2200) {
      out.push(b);
      continue;
    }
    let rest = b;
    while (rest.length > 2200) {
      let cut = rest.lastIndexOf('. ', 2200);
      if (cut < 800) cut = 2200;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1);
    }
    if (rest.trim().length > 40) out.push(rest.trim());
  }
  return out.map((textBlock, i) => ({
    id: `clause-${i + 1}`,
    index: i + 1,
    title: guessTitle(textBlock),
    text: textBlock,
  }));
}

function guessTitle(block) {
  const firstLine = block.split('\n')[0].trim();
  if (firstLine.length <= 90) {
    const cleaned = firstLine
      .replace(/^[IVXLC]{1,6}[.)]\s+/i, '')
      .replace(/^\d+(\.\d+)*[.)]?\s*/, '')
      .replace(/^[.)\s]+/, '')
      .replace(/[:.]$/, '')
      .trim();
    if (cleaned.length >= 3 && cleaned.length <= 70) return cleaned;
  }
  const words = block.replace(/\s+/g, ' ').split(' ').slice(0, 8).join(' ');
  return words + '…';
}

// Clause budget for very long documents.
export const MAX_CLAUSES = 60;

export function applyBudget(clauses) {
  if (clauses.length <= MAX_CLAUSES) return { clauses, skipped: 0 };
  return { clauses: clauses.slice(0, MAX_CLAUSES), skipped: clauses.length - MAX_CLAUSES };
}
