import { Building2, Globe, Users, Briefcase } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CompanyProfile } from '@/hooks/useCapstoneProjects';

interface CompanyCardProps {
  company: CompanyProfile;
}

export function CompanyCard({ company }: CompanyCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-sm truncate">{company.name}</h4>
            {company.sector && (
              <p className="text-xs text-muted-foreground">{company.sector}</p>
            )}
          </div>
          {company.data_completeness_score != null && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              {Math.round(company.data_completeness_score * 100)}%
            </Badge>
          )}
        </div>

        {company.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{company.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {company.size && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Users className="h-3 w-3" /> {company.size}
            </span>
          )}
          {company.employee_count && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Building2 className="h-3 w-3" /> {company.employee_count}
            </span>
          )}
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <Globe className="h-3 w-3" /> Website
            </a>
          )}
        </div>

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

        {Array.isArray(company.job_postings) && company.job_postings.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Briefcase className="h-3 w-3" /> {company.job_postings.length} job posting{company.job_postings.length !== 1 ? 's' : ''}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
