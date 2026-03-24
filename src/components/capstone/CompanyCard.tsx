import { Building2, Globe, Users, Briefcase, TrendingUp, Zap, Linkedin, DollarSign, Target, UserCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CompanyProfile } from '@/hooks/useCapstoneProjects';

interface CompanyCardProps {
  company: CompanyProfile;
}

const confidenceColors: Record<string, string> = {
  high: 'bg-green-500/10 text-green-700 border-green-200',
  medium: 'bg-amber-500/10 text-amber-700 border-amber-200',
  low: 'bg-red-500/10 text-red-700 border-red-200',
};

function getIntentLevel(signals: any): { label: string; className: string } | null {
  if (!signals) return null;
  const score = signals.compositeScore ?? signals.composite_score ?? 0;
  if (score >= 70) return { label: 'High Intent', className: 'bg-green-500/10 text-green-700 border-green-200' };
  if (score >= 40) return { label: 'Medium Intent', className: 'bg-amber-500/10 text-amber-700 border-amber-200' };
  if (score > 0) return { label: 'Low Intent', className: 'bg-red-500/10 text-red-700 border-red-200' };
  return null;
}

export function CompanyCard({ company }: CompanyCardProps) {
  const matchPercent = company.match_score != null ? Math.round(company.match_score * 100) : null;
  const enriched = !!company.last_enriched_at;
  const intentBadge = getIntentLevel(company.buying_intent_signals);
  const revenueRange = company.organization_revenue_range;
  const contactName = company.contact_first_name
    ? `${company.contact_first_name}${company.contact_last_name ? ' ' + company.contact_last_name : ''}`
    : company.contact_person;
  const contactSummary = contactName && company.contact_title
    ? `${contactName}, ${company.contact_title}`
    : contactName || null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4 space-y-2.5">
        {/* Header with match score */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-sm truncate">{company.name}</h4>
            {company.sector && company.sector !== 'Unknown' && (
              <p className="text-xs text-muted-foreground">{company.sector}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {company.match_confidence && (
              <Badge variant="outline" className={`text-[10px] ${confidenceColors[company.match_confidence] || ''}`}>
                {company.match_confidence}
              </Badge>
            )}
            {matchPercent != null && (
              <Badge className="text-[10px]">{matchPercent}%</Badge>
            )}
          </div>
        </div>

        {/* Match reason tooltip */}
        {company.match_reason && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground line-clamp-2 cursor-help">
                  {company.match_reason}
                </p>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{company.match_reason}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {!company.match_reason && company.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{company.description}</p>
        )}

        {/* Intent badge */}
        {intentBadge && (
          <Badge variant="outline" className={`text-[10px] ${intentBadge.className}`}>
            <Target className="h-3 w-3 mr-1" /> {intentBadge.label}
          </Badge>
        )}

        {/* Company metadata */}
        <div className="flex flex-wrap gap-1.5">
          {company.employee_count && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Users className="h-3 w-3" /> {company.employee_count.replace(/\s*employees$/i, '')} employees
            </span>
          )}
          {revenueRange && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <DollarSign className="h-3 w-3" /> {revenueRange}
            </span>
          )}
          {company.funding_stage && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> {company.funding_stage}
            </span>
          )}
          {company.website && (
            <a
              href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <Globe className="h-3 w-3" /> Website
            </a>
          )}
          {company.linkedin_profile && (
            <a
              href={company.linkedin_profile.startsWith('http') ? company.linkedin_profile : `https://${company.linkedin_profile}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <Linkedin className="h-3 w-3" /> LinkedIn
            </a>
          )}
          {enriched && (
            <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
              <Zap className="h-3 w-3" /> Enriched
            </span>
          )}
        </div>

        {/* Address */}
        {company.full_address && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Building2 className="h-3 w-3" /> {company.full_address}
          </span>
        )}

        {/* Contact summary */}
        {contactSummary && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <UserCheck className="h-3 w-3" /> {contactSummary}
          </span>
        )}

        {/* Technologies */}
        {company.technologies_used && company.technologies_used.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {company.technologies_used.slice(0, 5).map(tech => (
              <Badge key={tech} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {tech}
              </Badge>
            ))}
            {company.technologies_used.length > 5 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                +{company.technologies_used.length - 5}
              </Badge>
            )}
          </div>
        )}

        {/* Job postings + discovery source */}
        <div className="flex items-center justify-between">
          {Array.isArray(company.job_postings) && company.job_postings.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Briefcase className="h-3 w-3" /> {company.job_postings.length} job posting{company.job_postings.length !== 1 ? 's' : ''}
            </span>
          )}
          {company.discovery_source && (
            <span className="text-[9px] text-muted-foreground/60">
              via {company.discovery_source.replace('_', ' ')}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
