# ClauseLens

**Read the fine print — before you sign it.**

Upload any contract — rent agreement, job offer, insurance policy, terms of service — as a
PDF, photo, or pasted text. ClauseLens extracts the text (OCR for scans), detects the document
type and parties, asks **which side you're on**, and analyzes every clause from your
perspective: risk flags, plain-English translation, "is this unusual?", and what to negotiate
before signing. Ends with an overall grade and a downloadable report.

> ⚠️ ClauseLens is an AI reading aid, **not legal advice**.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173. Click ⚙ and add your Anthropic API key
(https://console.anthropic.com), then try **"Analyze a sample Noida rent agreement"** — a demo
contract seeded with clauses that genuinely appear in real Indian rent agreements (6-month
deposits, unilateral 15-day termination, landlord-appointed arbitrators…).

## How it works

| Stage | Tech |
|---|---|
| Text extraction | `pdf.js` text layer, in-browser |
| Scanned PDFs / photos | Auto-fallback to `tesseract.js` OCR (detects missing text layer) |
| Clause segmentation | Heuristic splitter (numbered sections, headings) with paragraph fallback; merges fragments, splits oversized clauses at sentence boundaries |
| Document profiling | Claude pass 0: type, parties, likely user role, jurisdiction hints |
| Perspective | You pick your party — the same clause reads differently for a tenant vs a landlord |
| Clause analysis | Claude, batched 8 clauses/call, streaming into the UI progressively |
| Summary | Grade A–F, top concerns, before-you-sign checklist |
| Report | Markdown export |

## Privacy model

Extraction and OCR run **entirely in your browser** — no upload server exists. Document text
is sent only to the Anthropic API for analysis. The API key lives in your browser's
localStorage.

**Deploying publicly?** Move the AI calls behind a small serverless proxy (Vercel/Cloudflare
function) so your key never ships to clients. Everything else is static.

## Failure handling

- Scanned PDF with no text layer → automatic per-page OCR with progress
- Low-confidence OCR → flagged, paste-text fallback offered
- Documents over 60 clauses → analyzed in order with a visible "skipped" note
- Failed analysis batch → completed clauses stay, per-batch retry button
- No API key → extraction still works; analysis prompts for key

## Roadmap (V2)

Hindi + regional-language contracts, side-by-side contract comparison ("old lease vs new
lease"), fair-clause library, shareable report links, WhatsApp share cards.

## Stack

Vite + React 18, pdf.js, tesseract.js, Claude API. No backend.
