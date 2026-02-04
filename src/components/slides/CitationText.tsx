/**
 * CitationText Component
 * 
 * Renders text with inline [Source N] markers as clickable citation links
 * with tooltips showing the source title and claim preview.
 */

import { parseTextWithCitations, type Citation } from '@/lib/citationParser';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CitationTextProps {
  text: string;
  citations: Citation[];
  className?: string;
}

export function CitationText({ text, citations, className }: CitationTextProps) {
  const segments = parseTextWithCitations(text, citations);
  
  // If no citations available, render as plain text
  if (!citations || citations.length === 0) {
    return <span className={className}>{text}</span>;
  }
  
  return (
    <span className={className}>
      {segments.map((segment, i) => {
        if (segment.type === 'text') {
          return <span key={i}>{segment.content}</span>;
        }
        
        // Citation segment - render as tooltip/link
        const hasValidUrl = segment.citation?.source_url && 
          segment.citation.source_url.startsWith('http');
        
        return (
          <Tooltip key={i} delayDuration={200}>
            <TooltipTrigger asChild>
              <a
                href={hasValidUrl ? segment.citation!.source_url : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center text-primary font-medium cursor-pointer",
                  "hover:underline hover:text-primary/80 transition-colors",
                  "text-[0.85em] align-baseline"
                )}
                onClick={(e) => {
                  if (!hasValidUrl) {
                    e.preventDefault();
                  }
                }}
              >
                <sup className="ml-0.5">[{segment.sourceIndex}]</sup>
              </a>
            </TooltipTrigger>
            <TooltipContent 
              side="top" 
              className="max-w-xs p-3"
              sideOffset={5}
            >
              {segment.citation ? (
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <p className="font-medium text-sm leading-tight">
                      {segment.citation.source_title || 'Unknown Source'}
                    </p>
                    {hasValidUrl && (
                      <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground mt-0.5" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {segment.citation.claim}
                  </p>
                  {hasValidUrl && (
                    <p className="text-xs text-primary truncate">
                      {new URL(segment.citation.source_url).hostname}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Source {segment.sourceIndex} not found
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}

export default CitationText;
