export interface ArgMismatch {
  field: string;
  expected: string;
  received: string;
  error?: string;
}

export function matchArgs(
  actual: Readonly<Record<string, unknown>>,
  expected: Record<string, unknown>,
  prefix = ''
): { matches: boolean; mismatches: ArgMismatch[] } {
  const mismatches: ArgMismatch[] = [];

  for (const [key, expectedVal] of Object.entries(expected)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const actualVal = actual[key];

    if (expectedVal instanceof RegExp) {
      if (typeof actualVal !== 'string') {
        mismatches.push({
          field: fieldPath,
          expected: `regex ${expectedVal}`,
          received: `${typeof actualVal} (not a string)`,
          error: `Cannot apply regex match to non-string field '${fieldPath}' of type '${typeof actualVal}'.`,
        });
        continue;
      }
      if (!expectedVal.test(actualVal)) {
        mismatches.push({
          field: fieldPath,
          expected: `regex ${expectedVal}`,
          received: truncate(actualVal, 100),
        });
      }
    } else if (
      expectedVal !== null &&
      typeof expectedVal === 'object' &&
      !Array.isArray(expectedVal) &&
      actualVal !== null &&
      typeof actualVal === 'object' &&
      !Array.isArray(actualVal)
    ) {
      // Recursive deep match for nested objects
      const nested = matchArgs(
        actualVal as Readonly<Record<string, unknown>>,
        expectedVal as Record<string, unknown>,
        fieldPath
      );
      mismatches.push(...nested.mismatches);
    } else if (Array.isArray(expectedVal) && Array.isArray(actualVal)) {
      // Array comparison: check each expected element
      if (expectedVal.length !== actualVal.length) {
        mismatches.push({
          field: fieldPath,
          expected: `array of length ${expectedVal.length}`,
          received: `array of length ${actualVal.length}`,
        });
      } else {
        for (let i = 0; i < expectedVal.length; i++) {
          const elemPath = `${fieldPath}[${i}]`;
          const ev = expectedVal[i];
          const av = actualVal[i];
          if (
            ev !== null &&
            typeof ev === 'object' &&
            !Array.isArray(ev) &&
            av !== null &&
            typeof av === 'object' &&
            !Array.isArray(av)
          ) {
            const nested = matchArgs(
              av as Readonly<Record<string, unknown>>,
              ev as Record<string, unknown>,
              elemPath
            );
            mismatches.push(...nested.mismatches);
          } else if (ev !== av) {
            mismatches.push({
              field: elemPath,
              expected: JSON.stringify(ev),
              received: JSON.stringify(av),
            });
          }
        }
      }
    } else {
      if (actualVal !== expectedVal) {
        mismatches.push({
          field: fieldPath,
          expected: JSON.stringify(expectedVal),
          received: JSON.stringify(actualVal),
        });
      }
    }
  }

  return { matches: mismatches.length === 0, mismatches };
}

export function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}
