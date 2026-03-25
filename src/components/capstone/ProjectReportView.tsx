import { useState } from 'react';
import {
  CheckCircle2, Building2, Mail, Phone, User, Globe, Briefcase, TrendingUp, Target,
  Star, Award, Clock, MapPin, BookOpen, Printer, DollarSign, Users, Zap, GraduationCap,
  BarChart3, Shield, Brain, Lightbulb, Handshake, Gem, Search, Cpu, ShieldCheck, LineChart
} from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCapstoneProject, useCompleteProject } from '@/hooks/useCapstoneProjects';
import type { CompanyProfile, ProjectForm } from '@/hooks/useCapstoneProjects';
import { ProposePartnershipDialog } from './ProposePartnershipDialog';
import { SectionHeading } from './shared';
import { useProjectMetadata, useGenerateValueAnalysis, useGeneratePremiumInsights } from '@/hooks/useProjectMetadata';
import {
  ValueAnalysisTab,
  PremiumInsightsTab,
  DiscoveryQualityTab,
  AlgorithmTransparencyTab,
  VerificationTab,
  EnhancedMarketIntelTab,
} from './ProjectDetailTabs';

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

function SignalBar({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  const percent = Math.round(value);
  const color = percent >= 70 ? 'bg-green-500' : percent >= 40 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{percent}%</span>
    </div>
  );
}

// ── Tab Components ──

function OverviewTab({ project, company, form1, form3, form4 }: any) {
  const loScore = project.lo_alignment_score != null ? Math.round(project.lo_alignment_score * 100) : 0;
  const budget = form1.budget || 0;
  const roiMultiplier = form1.roi_multiplier || 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 justify-center">
        <KPICard icon={Target} label="LO Coverage" value={`${loScore}%`} />
        <KPICard icon={DollarSign} label="Budget" value={budget > 0 ? `$${budget.toLocaleString()}` : 'TBD'} color="text-green-600" />
        <KPICard icon={Clock} label="Duration" value={`${form4.weeks || 15} wks`} color="text-amber-600" />
        <KPICard icon={Users} label="Team Size" value={`${form3.team_size || 4}`} color="text-blue-600" />
      </div>

      <SectionHeading title="Project Description" icon={BookOpen}>
        <p className="text-sm text-muted-foreground">{project.description}</p>
        {budget > 0 && roiMultiplier > 0 && (
          <p className="text-xs text-muted-foreground">Budget: ${budget.toLocaleString()} · ROI: {roiMultiplier.toFixed(1)}x</p>
        )}
      </SectionHeading>

      <Separator />

      {Array.isArray(project.tasks) && project.tasks.length > 0 && (
        <SectionHeading title={`Tasks (${project.tasks.length})`} icon={CheckCircle2}>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5">
            {(project.tasks as string[]).map((t: string, i: number) => (
              <li key={i} className="leading-relaxed">{typeof t === 'string' ? t : JSON.stringify(t)}</li>
            ))}
          </ol>
        </SectionHeading>
      )}

      {Array.isArray(project.deliverables) && project.deliverables.length > 0 && (
        <>
          <Separator />
          <SectionHeading title={`Deliverables (${project.deliverables.length})`} icon={Award}>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5">
              {(project.deliverables as string[]).map((d: string, i: number) => (
                <li key={i} className="leading-relaxed">{typeof d === 'string' ? d : JSON.stringify(d)}</li>
              ))}
            </ol>
          </SectionHeading>
        </>
      )}

      {project.skills && project.skills.length > 0 && (
        <>
          <Separator />
          <SectionHeading title={`Required Skills (${project.skills.length})`} icon={Zap}>
            <div className="flex flex-wrap gap-2">
              {project.skills.map((s: string) => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          </SectionHeading>
        </>
      )}
    </div>
  );
}

function MarketIntelTab({ company }: { company: CompanyProfile | null }) {
  if (!company) return <p className="text-sm text-muted-foreground py-4">No company data available.</p>;

  return (
    <div className="space-y-5">
      {/* Company Overview */}
      <SectionHeading title="Company Profile" icon={Building2}>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {(company.seo_description || company.description) && (
            <p className="col-span-2 text-muted-foreground">{company.seo_description || company.description}</p>
          )}
          {company.employee_count && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0" /> {company.employee_count}
            </span>
          )}
          {(company.organization_revenue_range || company.revenue_range) && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5 shrink-0" /> {company.organization_revenue_range || company.revenue_range}
            </span>
          )}
          {company.funding_stage && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" /> {company.funding_stage}
            </span>
          )}
          {company.organization_founded_year && company.organization_founded_year > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" /> Founded {company.organization_founded_year}
            </span>
          )}
        </div>
      </SectionHeading>

      <Separator />

      {/* Technology Stack */}
      {company.technologies_used && company.technologies_used.length > 0 && (
        <>
          <SectionHeading title="Technology Stack" icon={Zap}>
            <div className="flex flex-wrap gap-2">
              {company.technologies_used.map(tech => (
                <Badge key={tech} variant="outline" className="text-xs">{tech}</Badge>
              ))}
            </div>
          </SectionHeading>
          <Separator />
        </>
      )}

      {/* Active Hiring */}
      {company.job_postings && Array.isArray(company.job_postings) && company.job_postings.length > 0 && (
        <>
          <SectionHeading title={`Active Hiring (${company.job_postings.length})`} icon={Briefcase}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {company.job_postings.slice(0, 6).map((jp: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 rounded border text-xs">
                  <div>
                    <p className="font-medium">{jp.title}</p>
                    {jp.location && <p className="text-muted-foreground">{jp.location}</p>}
                  </div>
                  {jp.posted_date && (
                    <span className="text-muted-foreground text-[10px]">{new Date(jp.posted_date).toLocaleDateString()}</span>
                  )}
                </div>
              ))}
            </div>
          </SectionHeading>
          <Separator />
        </>
      )}

      {/* Inferred Needs */}
      {company.inferred_needs && company.inferred_needs.length > 0 && (
        <SectionHeading title="Inferred Needs" icon={Lightbulb}>
          <div className="flex flex-wrap gap-2">
            {company.inferred_needs.map((need, i) => (
              <Badge key={i} variant="outline" className="text-xs">{need}</Badge>
            ))}
          </div>
        </SectionHeading>
      )}

      {/* Industry Keywords */}
      {company.organization_industry_keywords && company.organization_industry_keywords.length > 0 && (
        <>
          <Separator />
          <SectionHeading title="Industry Keywords">
            <div className="flex flex-wrap gap-2">
              {company.organization_industry_keywords.map(kw => (
                <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
              ))}
            </div>
          </SectionHeading>
        </>
      )}
    </div>
  );
}

function ContactTab({ contact, form2, company, onProposePartnership }: any) {
  return (
    <div className="space-y-5">
      {/* Propose Partnership CTA */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Ready to reach out?</p>
          <p className="text-xs text-muted-foreground">Send a partnership proposal to {company?.name || 'this company'}</p>
        </div>
        <Button size="sm" className="gap-2" onClick={onProposePartnership}>
          <Handshake className="h-4 w-4" />
          Propose Partnership
        </Button>
      </div>

      <SectionHeading title="Primary Contact" icon={User}>
        <div className="grid grid-cols-2 gap-3 text-sm">
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
      </SectionHeading>

      {company?.contact_headline && (
        <>
          <Separator />
          <SectionHeading title="Contact Details">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>{company.contact_headline}</p>
              {company.contact_city && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {[company.contact_city, company.contact_state].filter(Boolean).join(', ')}</p>}
              {company.contact_email_status && <p>Email status: <Badge variant="outline" className="text-[10px]">{company.contact_email_status}</Badge></p>}
            </div>
          </SectionHeading>
        </>
      )}

      <Separator />

      <SectionHeading title="Company Location" icon={MapPin}>
        <div className="text-xs text-muted-foreground space-y-1">
          {company?.full_address && <p>{company.full_address}</p>}
          {!company?.full_address && company?.city && (
            <p>{[company.city, company.state, company.zip].filter(Boolean).join(', ')}</p>
          )}
          {company?.website && (
            <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline">
              <Globe className="h-3 w-3" /> {company.website}
            </a>
          )}
        </div>
      </SectionHeading>
    </div>
  );
}

function LOAlignmentTab({ project, form3 }: any) {
  const loScore = project.lo_alignment_score != null ? Math.round(project.lo_alignment_score * 100) : 0;

  return (
    <div className="space-y-5">
      <SectionHeading title="Overall LO Alignment" icon={Target}>
        <div className="flex items-center gap-4">
          <ScoreGauge label="LO Coverage" value={loScore} />
          {project.lo_alignment && (
            <p className="text-sm text-muted-foreground flex-1">{project.lo_alignment}</p>
          )}
        </div>
      </SectionHeading>

      {form3.lo_alignment_detail && Array.isArray(form3.lo_alignment_detail) && (
        <>
          <Separator />
          <SectionHeading title="Per-Objective Breakdown">
            <div className="space-y-2">
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
          </SectionHeading>
        </>
      )}

      {project.majors && project.majors.length > 0 && (
        <>
          <Separator />
          <SectionHeading title="Target Majors" icon={GraduationCap}>
            <div className="flex flex-wrap gap-2">
              {project.majors.map((m: string) => (
                <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
              ))}
            </div>
          </SectionHeading>
        </>
      )}
    </div>
  );
}

function TimelineTab({ milestones, form4, form5, form6, project }: any) {
  return (
    <div className="space-y-5">
      {/* Milestones */}
      {Array.isArray(milestones) && milestones.length > 0 && (
        <SectionHeading title="Milestones" icon={Clock}>
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
        </SectionHeading>
      )}

      {/* Logistics */}
      {form5.type && (
        <>
          <Separator />
          <SectionHeading title="Logistics" icon={MapPin}>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div><span className="font-medium text-foreground">Type:</span> {form5.type}</div>
              <div><span className="font-medium text-foreground">Scope:</span> {form5.scope}</div>
              <div><span className="font-medium text-foreground">Location:</span> {form5.location}</div>
              <div><span className="font-medium text-foreground">IP Terms:</span> {form5.ip_agreement}</div>
              {form5.equipment && (
                <div className="col-span-2"><span className="font-medium text-foreground">Equipment:</span> {form5.equipment}</div>
              )}
            </div>
          </SectionHeading>
        </>
      )}

      {/* Academic */}
      {form6.level && (
        <>
          <Separator />
          <SectionHeading title="Academic Details" icon={GraduationCap}>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div><span className="font-medium text-foreground">Level:</span> {form6.level}</div>
              <div><span className="font-medium text-foreground">Difficulty:</span> {form6.difficulty || project.tier}</div>
              <div><span className="font-medium text-foreground">Hours/Week:</span> {form6.hours_per_week}</div>
              <div><span className="font-medium text-foreground">Category:</span> {form6.category}</div>
            </div>
          </SectionHeading>
        </>
      )}
    </div>
  );
}

function ScoringTab({ project, company, form1 }: any) {
  const loScore = project.lo_alignment_score != null ? Math.round(project.lo_alignment_score * 100) : 0;
  const feasScore = project.feasibility_score != null ? Math.round(project.feasibility_score * 100) : 0;
  const finalScore = project.final_score != null ? Math.round(project.final_score * 100) : 0;
  const roiMultiplier = form1.roi_multiplier || 0;

  return (
    <div className="space-y-5">
      {/* Score Gauges */}
      <SectionHeading title="Project Scores">
        <div className="flex justify-center gap-8">
          <ScoreGauge label="LO Alignment" value={loScore} />
          <ScoreGauge label="Feasibility" value={feasScore} />
          <ScoreGauge label="Overall" value={finalScore} />
        </div>
      </SectionHeading>

      <Separator />

      {/* Company Signal Scores */}
      {company && (company.skill_match_score != null || company.composite_signal_score != null) && (
        <>
          <SectionHeading title="Company Signal Scores" icon={BarChart3}>
            <div className="space-y-2">
              <SignalBar label="Skill Match" value={company.skill_match_score} />
              <SignalBar label="Market Signal" value={company.market_signal_score} />
              <SignalBar label="Dept Fit" value={company.department_fit_score} />
              <SignalBar label="Contact Quality" value={company.contact_quality_score} />
              {company.composite_signal_score != null && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Composite Signal</span>
                    <span className="font-bold text-primary">{Math.round(company.composite_signal_score)}%</span>
                  </div>
                </>
              )}
            </div>
          </SectionHeading>
          <Separator />
        </>
      )}

      {/* Stakeholder ROI */}
      {roiMultiplier > 0 && (
        <SectionHeading title="Stakeholder ROI" icon={TrendingUp}>
          {(() => {
            const roiData = form1.roi_breakdown;
            if (!roiData) return <p className="text-xs text-muted-foreground italic">ROI breakdown not available.</p>;
            const sections = [
              { title: 'Students', key: 'students', labels: [['Career Readiness', 'career_readiness'], ['Skills', 'skills_development'], ['Portfolio', 'portfolio_value'], ['Network', 'network_growth']] },
              { title: 'University', key: 'university', labels: [['Partnership', 'partnership'], ['Placement', 'placement'], ['Research', 'research'], ['Reputation', 'reputation']] },
              { title: 'Industry', key: 'industry', labels: [['MROI', 'mroi'], ['Talent Pipeline', 'talent_pipeline'], ['Innovation', 'innovation'], ['Efficiency', 'efficiency']] },
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
        </SectionHeading>
      )}

      {/* Overall verification block */}
      <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Overall Match Score</p>
          <p className="text-xs text-muted-foreground">LO alignment + Feasibility + Mutual benefit</p>
        </div>
        <div className="text-2xl font-bold text-primary">{finalScore}%</div>
      </div>
    </div>
  );
}

// ── Main Component ──

export function ProjectReportView({ projectId, courseId, open, onOpenChange }: ProjectReportViewProps) {
  const { data: project, isLoading } = useCapstoneProject(projectId);
  const { data: metadata } = useProjectMetadata(projectId);
  const completeProject = useCompleteProject();
  const generateValueAnalysis = useGenerateValueAnalysis();
  const generatePremiumInsights = useGeneratePremiumInsights();
  const [activeTab, setActiveTab] = useState('overview');
  const [showProposalDialog, setShowProposalDialog] = useState(false);

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
  const finalScore = project.final_score != null ? Math.round(project.final_score * 100) : 0;

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
              {finalScore > 0 && <Badge className="text-sm px-3 py-1">{finalScore}% Match</Badge>}
              <Button variant="ghost" size="icon" className="h-8 w-8 print:hidden" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </ResponsiveDialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-0.5 print:hidden">
            <TabsTrigger value="overview" className="text-xs gap-1"><BookOpen className="h-3 w-3" /> Overview</TabsTrigger>
            <TabsTrigger value="market" className="text-xs gap-1"><TrendingUp className="h-3 w-3" /> Market Intel</TabsTrigger>
            <TabsTrigger value="contact" className="text-xs gap-1"><User className="h-3 w-3" /> Contact</TabsTrigger>
            <TabsTrigger value="alignment" className="text-xs gap-1"><Target className="h-3 w-3" /> LO Alignment</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs gap-1"><Clock className="h-3 w-3" /> Timeline</TabsTrigger>
            <TabsTrigger value="scoring" className="text-xs gap-1"><BarChart3 className="h-3 w-3" /> Scoring</TabsTrigger>
            <TabsTrigger value="value" className="text-xs gap-1"><Gem className="h-3 w-3" /> Value Analysis</TabsTrigger>
            <TabsTrigger value="insights" className="text-xs gap-1"><LineChart className="h-3 w-3" /> Premium Insights</TabsTrigger>
            <TabsTrigger value="discovery" className="text-xs gap-1"><Search className="h-3 w-3" /> Discovery Quality</TabsTrigger>
            <TabsTrigger value="algorithm" className="text-xs gap-1"><Cpu className="h-3 w-3" /> Algorithm</TabsTrigger>
            <TabsTrigger value="verification" className="text-xs gap-1"><ShieldCheck className="h-3 w-3" /> Verification</TabsTrigger>
            <TabsTrigger value="marketplus" className="text-xs gap-1"><DollarSign className="h-3 w-3" /> Market Intel+</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab project={project} company={company} form1={form1} form3={form3} form4={form4} />
          </TabsContent>
          <TabsContent value="market">
            <MarketIntelTab company={company} />
          </TabsContent>
          <TabsContent value="contact">
            <ContactTab contact={contact} form2={form2} company={company} onProposePartnership={() => setShowProposalDialog(true)} />
          </TabsContent>
          <TabsContent value="alignment">
            <LOAlignmentTab project={project} form3={form3} />
          </TabsContent>
          <TabsContent value="timeline">
            <TimelineTab milestones={milestones} form4={form4} form5={form5} form6={form6} project={project} />
          </TabsContent>
          <TabsContent value="scoring">
            <ScoringTab project={project} company={company} form1={form1} />
          </TabsContent>
          <TabsContent value="value">
            <ValueAnalysisTab
              metadata={metadata || null}
              onGenerate={() => generateValueAnalysis.mutate(projectId)}
              isGenerating={generateValueAnalysis.isPending}
            />
          </TabsContent>
          <TabsContent value="insights">
            <PremiumInsightsTab
              metadata={metadata || null}
              onGenerate={() => generatePremiumInsights.mutate(projectId)}
              isGenerating={generatePremiumInsights.isPending}
            />
          </TabsContent>
          <TabsContent value="discovery">
            <DiscoveryQualityTab company={company} metadata={metadata || null} />
          </TabsContent>
          <TabsContent value="algorithm">
            <AlgorithmTransparencyTab project={project} company={company} metadata={metadata || null} />
          </TabsContent>
          <TabsContent value="verification">
            <VerificationTab project={project} metadata={metadata || null} />
          </TabsContent>
          <TabsContent value="marketplus">
            <EnhancedMarketIntelTab company={company} metadata={metadata || null} form1={form1} />
          </TabsContent>
        </Tabs>

        {/* Partnership Proposal Dialog */}
        <ProposePartnershipDialog
          open={showProposalDialog}
          onOpenChange={setShowProposalDialog}
          projectId={projectId}
          courseId={courseId}
          projectTitle={project.title}
          company={company}
          contactName={form2.contact_name || contact?.name}
          contactEmail={form2.contact_email || contact?.email}
          contactTitle={form2.contact_title || contact?.title}
        />

        {/* Complete action */}
        {project.status === 'in_progress' && (
          <div className="pt-4 print:hidden">
            <Button
              onClick={() => completeProject.mutate({ projectId, courseId })}
              disabled={completeProject.isPending}
              className="gap-2 w-full"
            >
              <CheckCircle2 className="h-4 w-4" />
              {completeProject.isPending ? 'Extracting Skills...' : 'Mark Completed & Extract Skills'}
            </Button>
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
