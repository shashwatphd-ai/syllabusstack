import { Building2, Globe, Users, Briefcase, TrendingUp, Zap, Linkedin, DollarSign, Target, UserCheck, Twitter, Facebook, Calendar, BarChart3, Lightbulb } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import type { CompanyProfile } from '@/hooks/useCapstoneProjects';

interface CompanyCardProps {
  company: CompanyProfile;
}

const confidenceColors: Record<string, string> = {
  high: 'bg-green-500/10 text-green-700 border-green-200',
  medium: 'bg-amber-500/10 text-amber-700 border-amber-200',
  low: 'bg-red-500/10 text-red-700 border-red-200',
};

const enrichmentColors: Record<string, string> = {
  basic: 'bg-muted text-muted-foreground',
  apollo_verified: 'bg-blue-500/10 text-blue-700 border-blue-200',
  fully_enriched: 'bg-green-500/10 text-green-700 border-green-200',
};

function getIntentLevel(signals: any): { label: string; className: string } | null {
  if (!signals) return null;
  const score = signals.compositeScore ?? signals.composite_score ?? 0;
  if (score >= 70) return { label: 'High Intent', className: 'bg-green-500/10 text-green-700 border-green-200' };
  if (score >= 40) return { label: 'Medium Intent', className: 'bg-amber-500/10 text-amber-700 border-amber-200' };
  if (score > 0) return { label: 'Low Intent', className: 'bg-red-500/10 text-red-700 border-red-200' };
  return null;
}

function SignalBar({ label, value, icon }: { label: string; value: number | null; icon?: string }) {
  if (value == null) return null;
  const percent = Math.round(value);
  const color = percent >= 70 ? 'bg-green-500' : percent >= 40 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-14 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[10px] font-medium w-7 text-right">{percent}</span>
    </div>
  );
}

function getQualityGrade(score: number | null): { label: string; className: string } | null {
  if (score == null) return null;
  if (score >= 80) return { label: 'A+', className: 'bg-green-600 text-white border-green-600' };
  if (score >= 65) return { label: 'A', className: 'bg-green-500/15 text-green-700 border-green-300' };
  if (score >= 50) return { label: 'B', className: 'bg-amber-500/15 text-amber-700 border-amber-300' };
  if (score >= 30) return { label: 'C', className: 'bg-orange-500/15 text-orange-700 border-orange-300' };
  return { label: 'D', className: 'bg-red-500/15 text-red-700 border-red-300' };
}

export function CompanyCard({ company }: CompanyCardProps) {
  const compositeScore = company.composite_signal_score != null
    ? Math.round(company.composite_signal_score)
    : null;
  const matchPercent = company.match_score != null ? Math.round(company.match_score * 100) : null;
  const primaryScore = compositeScore ?? matchPercent;
  const grade = getQualityGrade(primaryScore);
  const enriched = !!company.last_enriched_at;
  const intentBadge = getIntentLevel(company.buying_intent_signals);
  const revenueRange = company.organization_revenue_range;
  const contactName = company.contact_first_name
    ? `${company.contact_first_name}${company.contact_last_name ? ' ' + company.contact_last_name : ''}`
    : company.contact_person;
  const contactSummary = contactName && company.contact_title
    ? `${contactName}, ${company.contact_title}`
    : contactName || null;

  const structuredAddress = [company.city, company.state, company.zip].filter(Boolean).join(', ') || company.full_address;

  const hasSignals = company.skill_match_score != null || company.market_signal_score != null
    || company.department_fit_score != null || company.contact_quality_score != null;

  return (
    <Card className={`hover:shadow-md transition-shadow ${grade?.label === 'A+' ? 'ring-1 ring-green-400/50' : ''}`}>
      <CardContent className="pt-4 pb-4 space-y-2.5">
        {/* Header with logo + composite score */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {company.organization_logo_url && (
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={company.organization_logo_url} alt={company.name} />
                <AvatarFallback className="text-[10px]">{company.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0">
              <h4 className="font-semibold text-sm truncate">{company.name}</h4>
              {company.sector && company.sector !== 'Unknown' && (
                <p className="text-xs text-muted-foreground">{company.sector}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {(company.signal_confidence || company.match_confidence) && (
              <Badge variant="outline" className={`text-[10px] ${confidenceColors[(company.signal_confidence || company.match_confidence)!] || ''}`}>
                {company.signal_confidence || company.match_confidence}
              </Badge>
            )}
            {primaryScore != null && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="text-[10px] cursor-help">{primaryScore}%</Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{compositeScore != null ? 'Composite Signal Score' : 'Match Score'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

        {/* Signal Score Breakdown */}
        {hasSignals && (
          <div className="space-y-1 pt-1 pb-0.5">
            <div className="flex items-center gap-1 mb-1">
              <BarChart3 className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground">Signal Breakdown</span>
            </div>
            <SignalBar label="Skills" value={company.skill_match_score} />
            <SignalBar label="Market" value={company.market_signal_score} />
            <SignalBar label="Dept Fit" value={company.department_fit_score} />
            <SignalBar label="Contact" value={company.contact_quality_score} />
          </div>
        )}

        {/* Intent + enrichment badges */}
        <div className="flex flex-wrap gap-1">
          {intentBadge && (
            <Badge variant="outline" className={`text-[10px] ${intentBadge.className}`}>
              <Target className="h-3 w-3 mr-1" /> {intentBadge.label}
            </Badge>
          )}
          {company.data_enrichment_level && company.data_enrichment_level !== 'basic' && (
            <Badge variant="outline" className={`text-[10px] ${enrichmentColors[company.data_enrichment_level] || ''}`}>
              <Zap className="h-3 w-3 mr-1" /> {company.data_enrichment_level.replace('_', ' ')}
            </Badge>
          )}
        </div>

        {/* Inferred Needs */}
        {company.inferred_needs && company.inferred_needs.length > 0 && (
          <div className="space-y-0.5">
            <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <Lightbulb className="h-3 w-3" /> Inferred Needs
            </span>
            <div className="flex flex-wrap gap-1">
              {company.inferred_needs.slice(0, 3).map((need, i) => (
                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-amber-700 border-amber-200 bg-amber-50">
                  {need}
                </Badge>
              ))}
              {company.inferred_needs.length > 3 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  +{company.inferred_needs.length - 3}
                </Badge>
              )}
            </div>
          </div>
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
          {company.organization_founded_year && company.organization_founded_year > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" /> Est. {company.organization_founded_year}
            </span>
          )}
        </div>

        {/* Social links */}
        <div className="flex flex-wrap gap-1.5">
          {company.website && (
            <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
              <Globe className="h-3 w-3" /> Website
            </a>
          )}
          {(company.organization_linkedin_url || company.linkedin_profile) && (
            <a href={(() => { const url = company.organization_linkedin_url || company.linkedin_profile || ''; return url.startsWith('http') ? url : `https://${url}`; })()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
              <Linkedin className="h-3 w-3" /> LinkedIn
            </a>
          )}
          {company.organization_twitter_url && (
            <a href={company.organization_twitter_url.startsWith('http') ? company.organization_twitter_url : `https://${company.organization_twitter_url}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
              <Twitter className="h-3 w-3" /> Twitter
            </a>
          )}
          {company.organization_facebook_url && (
            <a href={company.organization_facebook_url.startsWith('http') ? company.organization_facebook_url : `https://${company.organization_facebook_url}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
              <Facebook className="h-3 w-3" /> Facebook
            </a>
          )}
        </div>

        {/* Address */}
        {structuredAddress && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Building2 className="h-3 w-3" /> {structuredAddress}
          </span>
        )}

        {/* Contact summary with photo */}
        {contactSummary && (
          <div className="flex items-center gap-1.5">
            {company.contact_photo_url && (
              <Avatar className="h-5 w-5">
                <AvatarImage src={company.contact_photo_url} alt={contactName || ''} />
                <AvatarFallback className="text-[8px]">{(contactName || '?')[0]}</AvatarFallback>
              </Avatar>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              {!company.contact_photo_url && <UserCheck className="h-3 w-3" />}
              {contactSummary}
              {company.contact_headline && (
                <span className="text-muted-foreground/60"> — {company.contact_headline}</span>
              )}
            </span>
          </div>
        )}

        {/* Technologies */}
        {company.technologies_used && company.technologies_used.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {company.technologies_used.slice(0, 5).map(tech => (
              <Badge key={tech} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{tech}</Badge>
            ))}
            {company.technologies_used.length > 5 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">+{company.technologies_used.length - 5}</Badge>
            )}
          </div>
        )}

        {/* Industry keywords */}
        {company.organization_industry_keywords && company.organization_industry_keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {company.organization_industry_keywords.slice(0, 4).map(kw => (
              <Badge key={kw} variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">{kw}</Badge>
            ))}
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
