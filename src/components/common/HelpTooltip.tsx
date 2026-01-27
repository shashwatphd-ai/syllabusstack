import { useState } from 'react';
import { HelpCircle, ExternalLink, X } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HelpTooltipProps {
  content: string;
  title?: string;
  learnMoreUrl?: string;
  learnMoreText?: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'inline' | 'popover';
  className?: string;
}

const sizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function HelpTooltip({
  content,
  title,
  learnMoreUrl,
  learnMoreText = 'Learn more',
  placement = 'top',
  size = 'md',
  variant = 'icon',
  className,
}: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Simple tooltip version
  if (variant === 'icon' && !learnMoreUrl) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors",
                className
              )}
            >
              <HelpCircle className={sizeClasses[size]} />
            </button>
          </TooltipTrigger>
          <TooltipContent side={placement} className="max-w-xs">
            {title && <p className="font-medium mb-1">{title}</p>}
            <p className="text-sm">{content}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Popover version for more complex content
  if (variant === 'popover' || learnMoreUrl) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors",
              className
            )}
          >
            <HelpCircle className={sizeClasses[size]} />
          </button>
        </PopoverTrigger>
        <PopoverContent side={placement} className="w-80">
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              {title && <h4 className="font-medium">{title}</h4>}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 -mr-2 -mt-1"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{content}</p>
            {learnMoreUrl && (
              <a
                href={learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {learnMoreText}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Inline version (text with help icon)
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center gap-1 cursor-help", className)}>
            <HelpCircle className={sizeClasses[size]} />
          </span>
        </TooltipTrigger>
        <TooltipContent side={placement} className="max-w-xs">
          {title && <p className="font-medium mb-1">{title}</p>}
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Convenient wrapper for form labels with help
interface LabelWithHelpProps {
  label: string;
  helpContent: string;
  helpTitle?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
}

export function LabelWithHelp({
  label,
  helpContent,
  helpTitle,
  required = false,
  htmlFor,
  className,
}: LabelWithHelpProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("flex items-center gap-1.5 text-sm font-medium", className)}
    >
      {label}
      {required && <span className="text-destructive">*</span>}
      <HelpTooltip content={helpContent} title={helpTitle} size="sm" />
    </label>
  );
}

// Context-aware help component for specific features
interface FeatureHelpProps {
  feature:
    | 'dream-job'
    | 'gap-analysis'
    | 'verified-skills'
    | 'recommendations'
    | 'assessments'
    | 'certificates'
    | 'course-enrollment';
  className?: string;
}

const featureHelp: Record<string, { title: string; content: string; learnMoreUrl?: string }> = {
  'dream-job': {
    title: 'Dream Jobs',
    content: 'Add the careers you\'re interested in pursuing. We\'ll analyze the skills required and help you close any gaps.',
    learnMoreUrl: '/help/dream-jobs',
  },
  'gap-analysis': {
    title: 'Gap Analysis',
    content: 'Compares your current skills with what\'s required for your dream job. Shows which skills you need to develop.',
    learnMoreUrl: '/help/gap-analysis',
  },
  'verified-skills': {
    title: 'Verified Skills',
    content: 'Skills that have been confirmed through assessments. These appear on your profile and certificates.',
    learnMoreUrl: '/help/verified-skills',
  },
  'recommendations': {
    title: 'Recommendations',
    content: 'Personalized learning content suggested based on your skill gaps. Complete these to improve your match score.',
    learnMoreUrl: '/help/recommendations',
  },
  'assessments': {
    title: 'Assessments',
    content: 'Tests that verify your knowledge of course material. Passing assessments adds verified skills to your profile.',
    learnMoreUrl: '/help/assessments',
  },
  'certificates': {
    title: 'Certificates',
    content: 'Official credentials earned by completing courses. Certificates can be shared with employers and verified online.',
    learnMoreUrl: '/help/certificates',
  },
  'course-enrollment': {
    title: 'Course Enrollment',
    content: 'Join a course using an access code from your instructor. Pro subscribers can enroll for free.',
    learnMoreUrl: '/help/enrollment',
  },
};

export function FeatureHelp({ feature, className }: FeatureHelpProps) {
  const help = featureHelp[feature];
  if (!help) return null;

  return (
    <HelpTooltip
      title={help.title}
      content={help.content}
      learnMoreUrl={help.learnMoreUrl}
      variant="popover"
      className={className}
    />
  );
}
