export interface MarkdownStructure {
  headings: Array<{ level: number; text: string; line: number }>;
  codeBlocks: Array<{ lang: string | null; content: string; line: number }>;
  lists: Array<{ type: 'ordered' | 'unordered'; itemCount: number; line: number }>;
}

export function tokenizeMarkdown(input: string): MarkdownStructure {
  const lines = input.split('\n');
  const headings: MarkdownStructure['headings'] = [];
  const codeBlocks: MarkdownStructure['codeBlocks'] = [];
  const lists: MarkdownStructure['lists'] = [];

  let inCodeBlock = false;
  let codeBlockLang: string | null = null;
  let codeBlockContent: string[] = [];
  let codeBlockStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;

    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim() || null;
        codeBlockContent = [];
        codeBlockStart = i;
      } else {
        codeBlocks.push({
          lang: codeBlockLang,
          content: codeBlockContent.join('\n'),
          line: codeBlockStart,
        });
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      headings.push({
        level: (headingMatch[1] as string).length,
        text: (headingMatch[2] as string).trim(),
        line: i,
      });
    }

    if (/^\s*[-*+]\s/.test(line)) {
      const prev = lists[lists.length - 1];
      if (prev && prev.type === 'unordered' && prev.line + prev.itemCount === i) {
        prev.itemCount++;
      } else {
        lists.push({ type: 'unordered', itemCount: 1, line: i });
      }
    }
    if (/^\s*\d+[.)]\s/.test(line)) {
      const prev = lists[lists.length - 1];
      if (prev && prev.type === 'ordered' && prev.line + prev.itemCount === i) {
        prev.itemCount++;
      } else {
        lists.push({ type: 'ordered', itemCount: 1, line: i });
      }
    }
  }

  return { headings, codeBlocks, lists };
}
