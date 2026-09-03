// AI Analyzer — three passes over the Gemini API, called directly from the browser.
// Pass 0: document profile (type, parties). Pass 1..N: batched clause analysis
// from the user's perspective. Final: executive summary.

const MODEL = 'gemini-3.6-flash';
const BATCH_SIZE = 8;

export function getApiKey() {
  return localStorage.getItem('clauselens_api_key') || '';
}
export function setApiKey(k) {
  localStorage.setItem('clauselens_api_key', k);
}

async function callClaude(prompt, maxTokens = 2000) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_KEY');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 180)}`);
  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) {
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new Error('Gemini response was cut off (hit max token limit) before producing an answer.');
    }
    throw new Error('Gemini API returned an empty response.');
  }
  return text;
}

function parseJson(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not find JSON in the model's response: "${clean.slice(0, 200)}"`);
  }
  try {
    return JSON.parse(clean.slice(start, end + 1));
  } catch (e) {
    throw new Error(`Failed to parse the model's JSON response: ${e.message}`);
  }
}

export async function documentProfile(text) {
  const head = text.slice(0, 4500);
  const prompt = `Analyze the opening of this legal document and identify what it is.

<document_opening>
${head}
</document_opening>

Respond ONLY with JSON, no markdown fences:
{
  "docType": "short label e.g. Residential Rental Agreement, SaaS Terms of Service, Health Insurance Policy, Employment Contract",
  "parties": [{"name": "as written or role if unnamed", "role": "e.g. Landlord, Tenant, Employer, Service Provider, Customer, Insurer, Policyholder"}],
  "likelyUserRole": "which role the person uploading this most likely holds",
  "summary": "one sentence: what this document does",
  "jurisdictionHints": "any location/legal-system clues found, or null"
}`;
  return parseJson(await callClaude(prompt, 1500));
}

export async function analyzeClauseBatch(profile, userRole, clauses) {
  const clauseBlock = clauses
    .map((c) => `<clause id="${c.id}" title="${c.title}">\n${c.text.slice(0, 1800)}\n</clause>`)
    .join('\n\n');
  const prompt = `You are helping someone understand a contract BEFORE they sign it. You are not their lawyer and this is not legal advice — it is a plain-language reading aid.

Document type: ${profile.docType}
Parties: ${profile.parties.map((p) => `${p.name} (${p.role})`).join(', ')}
The reader is: ${userRole}
Analyze every clause FROM THE READER'S PERSPECTIVE (${userRole}). A clause that favors the other party is a risk for the reader.

${clauseBlock}

For EACH clause respond with an entry. Respond ONLY with JSON, no fences:
{
  "clauses": [
    {
      "id": "clause-N",
      "risk": "red" | "caution" | "standard" | "info",
      "plainEnglish": "1-3 sentences, everyday language, address the reader as 'you'",
      "isUnusual": true | false,
      "whyUnusual": "if unusual: what the market-standard version looks like; else null",
      "negotiationTip": "one concrete thing to ask/change/verify before signing, or null if nothing needed"
    }
  ]
}

Risk guide: "red" = clearly one-sided against the reader, waives important rights, or hides significant cost/liability. "caution" = worth understanding fully, potentially negotiable. "standard" = normal for this document type. "info" = definitions/boilerplate with no risk decision.`;
  const out = parseJson(await callClaude(prompt, 4500));
  return out.clauses || [];
}

export async function executiveSummary(profile, userRole, analyzedClauses) {
  const flagged = analyzedClauses
    .filter((c) => c.analysis && (c.analysis.risk === 'red' || c.analysis.risk === 'caution'))
    .map((c) => `- [${c.analysis.risk}] ${c.title}: ${c.analysis.plainEnglish}`)
    .join('\n');
  const counts = countRisks(analyzedClauses);
  const prompt = `A ${profile.docType} was analyzed for a ${userRole}. Risk counts: ${counts.red} red flags, ${counts.caution} caution, ${counts.standard} standard.

Flagged clauses:
${flagged || '(none)'}

Respond ONLY with JSON, no fences:
{
  "grade": "A" | "B" | "C" | "D" | "F",
  "verdict": "2-3 sentences: overall fairness of this document for the reader, in plain language",
  "topConcerns": ["most important issue", ...max 3],
  "beforeSigning": ["concrete question to ask or thing to verify", ...max 5]
}`;
  return parseJson(await callClaude(prompt, 1800));
}

export function countRisks(clauses) {
  const c = { red: 0, caution: 0, standard: 0, info: 0 };
  for (const cl of clauses) if (cl.analysis) c[cl.analysis.risk] = (c[cl.analysis.risk] || 0) + 1;
  return c;
}

export function batches(arr, size = BATCH_SIZE) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}