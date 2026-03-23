import { CheckCircle2, Building2, Mail, Phone, User, Globe, Briefcase, TrendingUp, Target,
  Star, Award, Clock, MapPin, BookOpen, Printer, DollarSign, Users, Zap, GraduationCap } from 'lucide-react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from '@/components/common/ResponsiveDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useCapstoneProject, useCompleteProject } from '@/hooks/useCapstoneProjects';
import type { CompanyProfile, ProjectForm } from '@/hooks/useCapstoneProjects';

interface ProjectReportViewProps {
  projectId: string;
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function KPICard({ icon: Icon, label, value, color = 'text-primary' }: { icon: any; label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted/50 min-w-[100px]">
      <Icon className={`h-5 w-5 ${color}`} />
      <span className="text-lg font-bold">{value}</span>
      <span className="text-[10px] text-muted-foreground text-center">{label}</span>
    </div>
  );
}

function ScoreGauge({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
            strokeDasharray={`${pct} 100`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{value}</span>
      </div>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="space-y-3 print:break-inside-avoid">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

export function ProjectReportView({ projectId, courseId, open, onOpenChange }: ProjectReportViewProps) {
  const { data: project, isLoading } = useCapstoneProject(projectId);
  const completeProject = useCompleteProject();

  if (!project) return null;

  const contact = project.contact as any;
  const company = project.company_profiles as CompanyProfile | null;
  const form = (project as any).form as ProjectForm | null;
  const form1 = form?.form1_project_details || {};
  const form2 = form?.form2_contact_info || {};
  const form3 = form?.form3_requirements || {};
  const form4 = form?.form4_timeline || {};
  const form5 = form?.form5_logistics || {};
  const form6 = form?.form6_academic || {};
  const milestones = form?.milestones || [];

  const loScore = project.lo_alignment_score != null ? Math.round(project.lo_alignment_score * 100) : 0;
  const feasScore = project.feasibility_score != null ? Math.round(project.feasibility_score * 100) : 0;
  const finalScore = project.final_score != null ? Math.round(project.final_score * 100) : 0;
  const budget = form1.budget || 0;
  const roiMultiplier = form1.roi_multiplier || 0;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible">
        <ResponsiveDialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <ResponsiveDialogTitle className="text-lg">{project.title}</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {company?.name} · {company?.sector !== 'Unknown' ? company?.sector : company?.industries?.[0] || 'Industry'}
              </ResponsiveDialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {finalScore > 0 && (
                <Badge className="text-sm px-3 py-1">{finalScore}% Match</Badge>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8 print:hidden" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </ResponsiveDialogHeader>

        <div className="space-y-5 py-2">
          {/* KPI Cards */}
          <div className="flex flex-wrap gap-3 justify-center">
            <KPICard icon={Target} label="LO Coverage" value={`${loScore}%`} />
            <KPICard icon={DollarSign} label="Budget" value={budget > 0 ? `$${budget.toLocaleString()}` : 'TBD'} color="text-green-600" />
            <KPICard icon={Clock} label="Duration" value={`${form4.weeks || 15} wks`} color="text-amber-600" />
            <KPICard icon={Users} label="Team Size" value={`${form3.team_size || 4}`} color="text-blue-600" />
          </div>

          <Separator />

          {/* Project Description */}
          <Section title="Project Description" icon={BookOpen}>
            <p className="text-sm text-muted-foreground">{project.description}</p>
            {budget > 0 && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                <span>Budget: ${budget.toLocaleString()}</span>
                {roiMultiplier > 0 && <span>ROI: {roiMultiplier.toFixed(1)}x</span>}
              </div>
            )}
          </Section>

          <Separator />

          {/* Tasks */}
          {Array.isArray(project.tasks) && project.tasks.length > 0 && (
            <Section title={`Tasks (${project.tasks.length})`} icon={CheckCircle2}>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5">
                {(project.tasks as string[]).map((t, i) => (
                  <li key={i} className="leading-relaxed">{typeof t === 'string' ? t : JSON.stringify(t)}</li>
                ))}
              </ol>
            </Section>
          )}

          <Separator />

          {/* Deliverables */}
          {Array.isArray(project.deliverables) && project.deliverables.length > 0 && (
            <Section title={`Deliverables (${project.deliverables.length})`} icon={Award}>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5">
                {(project.deliverables as string[]).map((d, i) => (
                  <li key={i} className="leading-relaxed">{typeof d === 'string' ? d : JSON.stringify(d)}</li>
                ))}
              </ol>
            </Section>
          )}

          <Separator />

          {/* Skills */}
          {project.skills && project.skills.length > 0 && (
            <Section title={`Required Skills (${project.skills.length})`} icon={Zap}>
              <div className="flex flex-wrap gap-2">
                {project.skills.map(s => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </Section>
          )}

          <Separator />

          {/* Value Analysis Scores */}
          <Section title="Value Analysis">
            <div className="flex justify-center gap-8">
              <ScoreGauge label="LO Alignment" value={loScore} />
              <ScoreGauge label="Feasibility" value={feasScore} />
              <ScoreGauge label="Overall Score" value={finalScore} />
            </div>
          </Section>

          <Separator />

          {/* Stakeholder ROI */}
          {roiMultiplier > 0 && (
            <>
              <Section title="Stakeholder ROI" icon={TrendingUp}>
                {(() => {
                  const roiData = form1.roi_breakdown;
                  if (!roiData) {
                    return <p className="text-xs text-muted-foreground italic">ROI breakdown not available for this project.</p>;
                  }
                  const sections: { title: string; key: string; labels: [string, string][] }[] = [
                    { title: 'For Students', key: 'students', labels: [['Career Readiness', 'career_readiness'], ['Skills Development', 'skills_development'], ['Portfolio Value', 'portfolio_value'], ['Network Growth', 'network_growth']] },
                    { title: 'For University', key: 'university', labels: [['Partnership', 'partnership'], ['Placement', 'placement'], ['Research', 'research'], ['Reputation', 'reputation']] },
                    { title: 'For Industry', key: 'industry', labels: [['MROI', 'mroi'], ['Talent Pipeline', 'talent_pipeline'], ['Innovation', 'innovation'], ['Efficiency', 'efficiency']] },
                  ];
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      {sections.map(section => (
                        <Card key={section.key}>
                          <CardHeader className="pb-2 pt-3 px-3">
                            <CardTitle className="text-xs font-medium text-muted-foreground">{section.title}</CardTitle>
                          </CardHeader>
                          <CardContent className="px-3 pb-3 space-y-1.5">
                            {section.labels.map(([label, field]) => (
                              <div key={field} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="font-medium">{roiData[section.key]?.[field] ?? 'N/A'}</span>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  );
                })()}
              </Section>
              <Separator />
            </>
          )}

          {/* Technology Stack */}
          {company?.technologies_used && company.technologies_used.length > 0 && (
            <>
              <Section title="Technology Stack" icon={Zap}>
                <div className="flex flex-wrap gap-2">
                  {company.technologies_used.map(tech => (
                    <Badge key={tech} variant="outline" className="text-xs">{tech}</Badge>
                  ))}
                </div>
              </Section>
              <Separator />
            </>
          )}

          {/* Active Hiring */}
          {company?.job_postings && Array.isArray(company.job_postings) && company.job_postings.length > 0 && (
            <>
              <Section title={`Active Hiring (${company.job_postings.length} postings)`} icon={Briefcase}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {company.job_postings.slice(0, 6).map((jp: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded border text-xs">
                      <div>
                        <p className="font-medium">{jp.title}</p>
                        {jp.location && <p className="text-muted-foreground">{jp.location}</p>}
                      </div>
                      {jp.posted_date && (
                        <span className="text-muted-foreground text-[10px]">
                          {new Date(jp.posted_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
              <Separator />
            </>
          )}

          {/* Company Information */}
          <Section title="Company Information" icon={Building2}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {company?.description && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">{company.seo_description || company.description}</p>
                </div>
              )}
              {company?.full_address && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> {company.full_address}
                </span>
              )}
              {company?.employee_count && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5 shrink-0" /> {company.employee_count.replace(/\s*employees$/i, '')} employees
                </span>
              )}
              {company?.funding_stage && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" /> {company.funding_stage}
                </span>
              )}
              {company?.website && (
                <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <Globe className="h-3.5 w-3.5 shrink-0" /> {company.website}
                </a>
              )}
              {company?.data_completeness_score != null && (
                <div className="col-span-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Data Quality:</span>
                  <Progress value={Math.round(company.data_completeness_score * 100)} className="h-2 flex-1" />
                  <span className="text-xs font-medium">{Math.round(company.data_completeness_score * 100)}%</span>
                </div>
              )}
            </div>
          </Section>

          <Separator />

          {/* Contact Information */}
          <Section title="Contact Information" icon={User}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {(form2.contact_name || contact?.name) && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" /> {form2.contact_name || contact?.name}
                </span>
              )}
              {(form2.contact_title || contact?.title) && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" /> {form2.contact_title || contact?.title}
                </span>
              )}
              {(form2.contact_email || contact?.email) && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> {form2.contact_email || contact?.email}
                </span>
              )}
              {(form2.contact_phone || contact?.phone) && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> {form2.contact_phone || contact?.phone}
                </span>
              )}
            </div>
          </Section>

          <Separator />

          {/* Timeline & Milestones */}
          {Array.isArray(milestones) && milestones.length > 0 && (
            <>
              <Section title="Timeline & Milestones" icon={Clock}>
                <div className="space-y-1.5">
                  {milestones.map((m: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <Badge variant={m.type === 'final' ? 'default' : 'outline'} className="text-[10px] min-w-[60px] justify-center">
                        Week {m.week}
                      </Badge>
                      <span className="text-muted-foreground">{m.deliverable}</span>
                    </div>
                  ))}
                </div>
              </Section>
              <Separator />
            </>
          )}

          {/* Logistics */}
          {form5.type && (
            <>
              <Section title="Logistics" icon={MapPin}>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><span className="font-medium text-foreground">Type:</span> {form5.type}</div>
                  <div><span className="font-medium text-foreground">Scope:</span> {form5.scope}</div>
                  <div><span className="font-medium text-foreground">Location:</span> {form5.location}</div>
                  <div><span className="font-medium text-foreground">IP Terms:</span> {form5.ip_agreement}</div>
                  {form5.equipment && (
                    <div className="col-span-2"><span className="font-medium text-foreground">Equipment:</span> {form5.equipment}</div>
                  )}
                </div>
              </Section>
              <Separator />
            </>
          )}

          {/* Academic Information */}
          {form6.level && (
            <>
              <Section title="Academic Information" icon={GraduationCap}>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><span className="font-medium text-foreground">Level:</span> {form6.level}</div>
                  <div><span className="font-medium text-foreground">Difficulty:</span> {form6.difficulty || project.tier}</div>
                  <div><span className="font-medium text-foreground">Hours/Week:</span> {form6.hours_per_week}</div>
                  <div><span className="font-medium text-foreground">Category:</span> {form6.category}</div>
                  {project.majors && project.majors.length > 0 && (
                    <div className="col-span-2">
                      <span className="font-medium text-foreground">Majors:</span>{' '}
                      {project.majors.join(', ')}
                    </div>
                  )}
                </div>
              </Section>
              <Separator />
            </>
          )}

          {/* LO Alignment Detail */}
          {project.lo_alignment && (
            <Section title="Learning Objective Alignment" icon={Target}>
              <p className="text-sm text-muted-foreground">{project.lo_alignment}</p>
              {form3.lo_alignment_detail && Array.isArray(form3.lo_alignment_detail) && (
                <div className="mt-3 space-y-2">
                  {form3.lo_alignment_detail.map((detail: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-medium min-w-[40px]">LO{i + 1}</span>
                      <Progress value={detail.coverage || detail.score || 0} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground min-w-[35px] text-right">
                        {detail.coverage || detail.score || 0}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Overall Match / Verification */}
          <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Overall Match Score</p>
              <p className="text-xs text-muted-foreground">LO alignment + Feasibility + Mutual benefit</p>
            </div>
            <div className="text-2xl font-bold text-primary">{finalScore}%</div>
          </div>

          {/* Complete action */}
          {project.status === 'in_progress' && (
            <Button
              onClick={() => completeProject.mutate({ projectId, courseId })}
              disabled={completeProject.isPending}
              className="gap-2 w-full print:hidden"
            >
              <CheckCircle2 className="h-4 w-4" />
              {completeProject.isPending ? 'Extracting Skills...' : 'Mark Completed & Extract Skills'}
            </Button>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
