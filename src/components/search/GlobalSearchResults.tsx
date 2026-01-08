import { useNavigate } from 'react-router-dom';
import { Book, Briefcase, Lightbulb, Award, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SearchResult } from '@/hooks/useGlobalSearch';

interface GlobalSearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
  onSelect: () => void;
  query: string;
}

const typeConfig = {
  course: {
    icon: Book,
    label: 'Course',
    color: 'text-blue-500',
  },
  dream_job: {
    icon: Briefcase,
    label: 'Dream Job',
    color: 'text-accent',
  },
  recommendation: {
    icon: Lightbulb,
    label: 'Recommendation',
    color: 'text-yellow-500',
  },
  capability: {
    icon: Award,
    label: 'Capability',
    color: 'text-green-500',
  },
};

export function GlobalSearchResults({ results, isLoading, onSelect, query }: GlobalSearchResultsProps) {
  const navigate = useNavigate();

  if (query.length < 2) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Type at least 2 characters to search
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Searching...</span>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No results found for "{query}"
      </div>
    );
  }

  // Group results by type
  const grouped = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const handleSelect = (url: string) => {
    navigate(url);
    onSelect();
  };

  return (
    <div className="max-h-80 overflow-y-auto">
      {Object.entries(grouped).map(([type, items]) => {
        const config = typeConfig[type as keyof typeof typeConfig];
        const Icon = config.icon;

        return (
          <div key={type} className="border-b last:border-b-0">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
              {config.label}s
            </div>
            {items.map((result) => (
              <button
                key={result.id}
                onClick={() => handleSelect(result.url)}
                className={cn(
                  "w-full px-3 py-2 flex items-center gap-3 text-left",
                  "hover:bg-muted/50 transition-colors"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", config.color)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{result.title}</p>
                  {result.subtitle && (
                    <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
