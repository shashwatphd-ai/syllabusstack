import { ExternalLink, Clock, Star, DollarSign, GraduationCap, Check, Plus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CourseCardProps {
  title: string;
  provider: string;
  url: string;
  description: string;
  duration?: string;
  rating?: string;
  price?: string;
  gapAddressed?: string;
  isSaved?: boolean;
  onSave?: () => void;
  priority?: 'high' | 'medium' | 'low';
}

const providerColors: Record<string, string> = {
  'Coursera': 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  'Udemy': 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  'edX': 'bg-red-500/10 text-red-600 border-red-500/30',
  'LinkedIn Learning': 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  'Pluralsight': 'bg-pink-500/10 text-pink-600 border-pink-500/30',
};

const priorityStyles: Record<string, string> = {
  high: 'border-l-4 border-l-red-500',
  medium: 'border-l-4 border-l-yellow-500',
  low: 'border-l-4 border-l-green-500',
};

export function CourseCard({
  title,
  provider,
  url,
  description,
  duration,
  rating,
  price,
  gapAddressed,
  isSaved = false,
  onSave,
  priority,
}: CourseCardProps) {
  const providerStyle = providerColors[provider] || 'bg-muted text-muted-foreground';
  
  return (
    <Card className={cn(
      "group hover:shadow-lg transition-all duration-200 overflow-hidden",
      priority && priorityStyles[priority]
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={providerStyle}>
                <GraduationCap className="h-3 w-3 mr-1" />
                {provider}
              </Badge>
              {priority && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    priority === 'high' && 'bg-red-500/10 text-red-600 border-red-500/30',
                    priority === 'medium' && 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
                    priority === 'low' && 'bg-green-500/10 text-green-600 border-green-500/30',
                  )}
                >
                  {priority === 'high' ? 'Top Pick' : priority === 'medium' ? 'Recommended' : 'Good Option'}
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {title}
            </h3>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description || 'Learn essential skills for your career goals.'}
        </p>
        
        {/* Metadata row */}
        <div className="flex items-center gap-4 text-sm flex-wrap">
          {duration && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{duration}</span>
            </div>
          )}
          {rating && (
            <div className="flex items-center gap-1 text-amber-600">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span>{rating}</span>
            </div>
          )}
          {price && (
            <div className={cn(
              "flex items-center gap-1",
              price.toLowerCase() === 'free' ? 'text-green-600' : 'text-muted-foreground'
            )}>
              <DollarSign className="h-3.5 w-3.5" />
              <span>{price}</span>
            </div>
          )}
        </div>
        
        {/* Gap addressed */}
        {gapAddressed && (
          <div className="text-xs bg-accent/50 rounded-md px-2 py-1.5">
            <span className="text-muted-foreground">Addresses: </span>
            <span className="font-medium">{gapAddressed}</span>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button 
            asChild 
            variant="default" 
            size="sm" 
            className="flex-1"
          >
            <a href={url} target="_blank" rel="noopener noreferrer">
              View Course
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
          
          {onSave && (
            <Button
              variant={isSaved ? "secondary" : "outline"}
              size="sm"
              onClick={onSave}
              disabled={isSaved}
            >
              {isSaved ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Saved
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Save
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
