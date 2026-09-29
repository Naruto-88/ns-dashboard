/**
 * Utility to calculate word-by-word diff between original HTML/text and edited HTML/text.
 * Uses paragraph-level chunking and Longest Common Subsequence (LCS) to scale to
 * arbitrarily long blogs (1,000 to 5,000+ words) without collapsing into single giant blocks.
 */

export interface DiffPart {
  type: 'equal' | 'added' | 'removed';
  value: string;
}

export function computeWordDiff(originalHtml: string, editedHtml: string): DiffPart[] {
  const normalize = (html: string) => {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, text) => `\n\n# ${text.trim()}\n\n`)
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, text) => `\n\n## ${text.trim()}\n\n`)
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, text) => `\n\n### ${text.trim()}\n\n`)
      .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, (_, text) => `\n\n#### ${text.trim()}\n\n`)
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<(strong|b)>(.*?)<\/\1>/gi, '**$2**')
      .replace(/<(em|i)>(.*?)<\/\1>/gi, '*$2*')
      .replace(/<a\s+href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<u>(.*?)<\/u>/gi, '__$1__')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .trim();
  };

  const text1 = normalize(originalHtml);
  const text2 = normalize(editedHtml);

  if (text1 === text2) {
    return [{ type: 'equal', value: text1 }];
  }

  // Split into paragraphs / lines to diff chunk by chunk
  const paragraphs1 = text1.split(/\n\n+/);
  const paragraphs2 = text2.split(/\n\n+/);

  // Split text into tokens: keep headings (lines starting with #) as cohesive single tokens
  // and split regular paragraphs into words + whitespace.
  const tokenize = (text: string) => {
    const lines = text.split('\n');
    const tokens: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^#{1,6}\s+/.test(line.trim())) {
        tokens.push(line);
      } else {
        const parts = line.split(/(\s+)/).filter(Boolean);
        tokens.push(...parts);
      }
      if (i < lines.length - 1) {
        tokens.push('\n');
      }
    }
    return tokens;
  };

  const words1 = tokenize(text1);
  const words2 = tokenize(text2);

  if (words1.length * words2.length <= 4000000) {
    return diffTokens(words1, words2);
  }

  // For very long multi-paragraph articles (3000+ words), diff paragraph by paragraph with word-level LCS inside
  const result: DiffPart[] = [];
  const maxP = Math.max(paragraphs1.length, paragraphs2.length);

  for (let idx = 0; idx < maxP; idx++) {
    const p1 = paragraphs1[idx] || '';
    const p2 = paragraphs2[idx] || '';

    if (idx > 0) {
      result.push({ type: 'equal', value: '\n\n' });
    }

    if (p1 === p2) {
      result.push({ type: 'equal', value: p1 });
    } else if (!p1 && p2) {
      result.push({ type: 'added', value: p2 });
    } else if (p1 && !p2) {
      result.push({ type: 'removed', value: p1 });
    } else {
      const pWords1 = p1.split(/(\s+)/);
      const pWords2 = p2.split(/(\s+)/);
      result.push(...diffTokens(pWords1, pWords2));
    }
  }

  return result;
}

function diffTokens(words1: string[], words2: string[]): DiffPart[] {
  const n = words1.length;
  const m = words2.length;

  if (n === 0) return words2.map(w => ({ type: 'added', value: w }));
  if (m === 0) return words1.map(w => ({ type: 'removed', value: w }));

  // Dynamic programming LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (words1[i - 1] === words2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = n;
  let j = m;
  const result: DiffPart[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && words1[i - 1] === words2[j - 1]) {
      result.unshift({ type: 'equal', value: words1[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', value: words2[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({ type: 'removed', value: words1[i - 1] });
      i--;
    }
  }

  return result;
}
