export function extractJson(input: string): { json: unknown; raw: string } | null {
  const fenced = input.match(/```json\s*\n([\s\S]*?)```/);
  if (fenced) {
    try {
      const raw = fenced[1] as string;
      return { json: JSON.parse(raw), raw };
    } catch {
      /* fall through */
    }
  }

  const braceStart = input.indexOf('{');
  const bracketStart = input.indexOf('[');
  const start =
    braceStart === -1
      ? bracketStart
      : bracketStart === -1
        ? braceStart
        : Math.min(braceStart, bracketStart);

  if (start === -1) return null;

  // Use bracket counting to find the matching close, avoiding O(n²) JSON.parse
  const openChar = input[start] as string;
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i++) {
    const ch = input[i] as string;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        const candidate = input.slice(start, i + 1);
        try {
          return { json: JSON.parse(candidate), raw: candidate };
        } catch {
          // Malformed — keep scanning for next top-level open
          const next = extractJson(input.slice(i + 1));
          return next;
        }
      }
    }
  }

  return null;
}
