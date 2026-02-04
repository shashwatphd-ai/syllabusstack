/**
 * Citation Parser Utility
 * 
 * Parses text containing [Source N] markers and maps them to actual citation data
 * from the research_context.grounded_content array.
 */

export interface Citation {
  claim: string;
  source_url: string;
  source_title: string;
  confidence?: number;
}

export interface ParsedTextSegment {
  type: 'text' | 'citation';
  content: string;
  citation?: Citation;
  sourceIndex?: number;
}

/**
 * Parses text containing [Source N] markers and returns segments
 * that can be rendered with inline citation links.
 * 
 * @param text - The text containing [Source N] markers
 * @param citations - Array of citation objects from research_context.grounded_content
 * @returns Array of segments, each either text or a citation reference
 * 
 * @example
 * const text = "This is important [Source 1] and also this [Source 3].";
 * const citations = [{ claim: "...", source_url: "...", source_title: "..." }, ...];
 * const segments = parseTextWithCitations(text, citations);
 * // Returns: [
 * //   { type: 'text', content: 'This is important ' },
 * //   { type: 'citation', content: '[Source 1]', sourceIndex: 1, citation: citations[0] },
 * //   { type: 'text', content: ' and also this ' },
 * //   { type: 'citation', content: '[Source 3]', sourceIndex: 3, citation: citations[2] },
 * //   { type: 'text', content: '.' }
 * // ]
 */
export function parseTextWithCitations(
  text: string,
  citations: Citation[] = []
): ParsedTextSegment[] {
  if (!text) return [];
  
  const segments: ParsedTextSegment[] = [];
  const regex = /\[Source (\d+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the citation
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add citation segment (convert 1-indexed to 0-indexed)
    const sourceIndex = parseInt(match[1], 10);
    const citation = citations[sourceIndex - 1]; // [Source 1] maps to citations[0]
    
    segments.push({
      type: 'citation',
      content: match[0],
      sourceIndex,
      citation: citation || undefined,
    });

    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last citation
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  // If no citations found, return single text segment
  if (segments.length === 0 && text) {
    return [{ type: 'text', content: text }];
  }

  return segments;
}

/**
 * Check if text contains any [Source N] markers
 */
export function hasCitationMarkers(text: string): boolean {
  return /\[Source \d+\]/.test(text);
}
