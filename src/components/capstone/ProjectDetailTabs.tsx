/**
 * Additional Project Detail Tabs (Phase 2)
 * Value Analysis, Premium Insights, Discovery Quality,
 * Algorithm Transparency, Verification, Enhanced Market Intel
 */

import {
  TrendingUp, DollarSign, Users, Brain, Lightbulb, Target, Zap,
  ShieldCheck, Cpu, Search, LineChart, CheckCircle2, AlertTriangle,
  XCircle, BarChart3, Clock, Building2, Briefcase, GraduationCap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { SectionHeading, EmptyState, StatusIcon } from './shared';
import type { ProjectMetadata } from '@/hooks/useProjectMetadata';
import type { CompanyProfile } from '@/hooks/useCapstoneProjects';
}

// ── Value Analysis Tab ──

interface ValueAnalysisTabProps {
  metadata: ProjectMetadata | null;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function ValueAnalysisTab({ metadata, onGenerate, isGenerating }: ValueAnalysisTabProps) {
  const va = metadata?.value_analysis;
  const si = metadata?.stakeholder_insights;

  if (!va && !si) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No Value Analysis Yet"
        description="Generate AI-powered stakeholder ROI analysis for this project."
        action={
          <Button size="sm" className="gap-2 mt-2" onClick={onGenerate} disabled={isGenerating}>
            <Brain className="h-4 w-4" />
            {isGenerating ? 'Generating...' : 'Generate Analysis'}
          </Button>
        }
      />
    );
  }

  const stakeholders = [
    { key: 'students', title: 'Students', icon: GraduationCap, color: 'text-blue-600' },
    { key: 'university', title: 'University', icon: Building2, color: 'text-purple-600' },
    { key: 'industry', title: 'Industry Partner', icon: Briefcase, color: 'text-green-600' },
  ];

  return (
    <div className="space-y-5">
      {/* Synergistic Value Index */}
      {metadata?.synergistic_value_index != null && (
        <>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Synergistic Value Index</p>
              <p className="text-xs text-muted-foreground">Combined stakeholder benefit score</p>
            </div>
            <span className="text-2xl font-bold text-primary">{Math.round(metadata.synergistic_value_index)}%</span>
          </div>
          <Separator />
        </>
      )}

      {/* Stakeholder ROI Cards */}
      {va && (
        <SectionHeading title="Stakeholder ROI Breakdown" icon={TrendingUp}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {stakeholders.map(({ key, title, icon: SIcon, color }) => {
              const data = va[key];
              if (!data) return null;
              return (
                <Card key={key}>
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className={`text-xs font-medium flex items-center gap-1.5 ${color}`}>
                      <SIcon className="h-3.5 w-3.5" /> {title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    {typeof data === 'object' && !Array.isArray(data) ? (
                      <div className="space-y-1.5">
                        {Object.entries(data).map(([field, value]) => (
                          <div key={field} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground capitalize">{field.replace(/_/g, ' ')}</span>
                            <span className="font-medium">{typeof value === 'number' ? `${value}%` : String(value)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{String(data)}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </SectionHeading>
      )}

      {/* Stakeholder Insights */}
      {si && (
        <>
          <Separator />
          <SectionHeading title="Key Insights" icon={Lightbulb}>
            {Array.isArray(si) ? (
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
                {si.map((insight: string, i: number) => <li key={i}>{insight}</li>)}
              </ul>
            ) : typeof si === 'object' ? (
              <div className="space-y-2">
                {Object.entries(si).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="font-medium capitalize">{key.replace(/_/g, ' ')}: </span>
                    <span className="text-muted-foreground">{String(value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{String(si)}</p>
            )}
          </SectionHeading>
        </>
      )}

      {/* Regenerate button */}
      <div className="pt-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={onGenerate} disabled={isGenerating}>
          <Brain className="h-3.5 w-3.5" />
          {isGenerating ? 'Regenerating...' : 'Regenerate Analysis'}
        </Button>
      </div>
    </div>
  );
}

// ── Premium Insights Tab ──

interface PremiumInsightsTabProps {
  metadata: ProjectMetadata | null;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function PremiumInsightsTab({ metadata, onGenerate, isGenerating }: PremiumInsightsTabProps) {
  const skillGap = metadata?.skill_gap_analysis;
  const salary = metadata?.salary_projections;

  if (!skillGap && !salary) {
    return (
      <EmptyState
        icon={LineChart}
        title="No Premium Insights Yet"
        description="Generate skill gap analysis and salary ROI projections."
        action={
          <Button size="sm" className="gap-2 mt-2" onClick={onGenerate} disabled={isGenerating}>
            <Brain className="h-4 w-4" />
            {isGenerating ? 'Generating...' : 'Generate Insights'}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Skill Gap Analysis */}
      {skillGap && (
        <SectionHeading title="Skill Gap Analysis" icon={Zap}>
          {Array.isArray(skillGap) ? (
            <div className="space-y-2">
              {skillGap.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-medium min-w-[120px] truncate">{item.skill || item.name}</span>
                  <Progress value={item.current_level || item.level || 0} className="h-2 flex-1" />
                  <div className="flex items-center gap-2 min-w-[80px]">
                    <span className="text-xs text-muted-foreground">{item.current_level || item.level || 0}%</span>
                    {item.target_level && (
                      <span className="text-[10px] text-primary">/{item.target_level}%</span>
                    )}
                  </div>
                  {item.gap && (
                    <Badge variant={item.gap > 20 ? 'destructive' : 'secondary'} className="text-[10px]">
                      -{item.gap}%
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : typeof skillGap === 'object' ? (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(skillGap).map(([skill, data]: [string, any]) => (
                <div key={skill} className="p-2 rounded border text-xs">
                  <p className="font-medium capitalize">{skill.replace(/_/g, ' ')}</p>
                  <p className="text-muted-foreground">{typeof data === 'object' ? JSON.stringify(data) : String(data)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{String(skillGap)}</p>
          )}
        </SectionHeading>
      )}

      {skillGap && salary && <Separator />}

      {/* Salary Projections */}
      {salary && (
        <SectionHeading title="Salary ROI Projections" icon={DollarSign}>
          {Array.isArray(salary) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {salary.map((item: any, i: number) => (
                <Card key={i}>
                  <CardContent className="p-3">
                    <p className="text-xs font-medium">{item.role || item.title || `Role ${i + 1}`}</p>
                    {item.salary_range && (
                      <p className="text-sm font-bold text-green-600 mt-1">{item.salary_range}</p>
                    )}
                    {item.median_salary && (
                      <p className="text-sm font-bold text-green-600 mt-1">${item.median_salary.toLocaleString()}</p>
                    )}
                    {item.growth && (
                      <p className="text-[10px] text-muted-foreground mt-1">Growth: {item.growth}%</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : typeof salary === 'object' ? (
            <div className="space-y-2">
              {Object.entries(salary).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="font-medium">{typeof value === 'number' ? `$${value.toLocaleString()}` : String(value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{String(salary)}</p>
          )}
        </SectionHeading>
      )}

      {/* Regenerate */}
      <div className="pt-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={onGenerate} disabled={isGenerating}>
          <Brain className="h-3.5 w-3.5" />
          {isGenerating ? 'Regenerating...' : 'Regenerate Insights'}
        </Button>
      </div>
    </div>
  );
}

// ── Discovery Quality Tab ──

interface DiscoveryQualityTabProps {
  company: CompanyProfile | null;
  metadata: ProjectMetadata | null;
}

export function DiscoveryQualityTab({ company, metadata }: DiscoveryQualityTabProps) {
  const dq = metadata?.discovery_quality;

  // Build signal data from company scores even if metadata doesn't have discovery_quality
  const signals = [
    { label: 'Skill Match', value: company?.skill_match_score, description: 'How well company tech stack matches course skills' },
    { label: 'Market Signal', value: company?.market_signal_score, description: 'Hiring activity, growth signals, and market presence' },
    { label: 'Department Fit', value: company?.department_fit_score, description: 'Alignment between company departments and academic discipline' },
    { label: 'Contact Quality', value: company?.contact_quality_score, description: 'Availability and seniority of decision-maker contacts' },
  ];

  const hasAnySignal = signals.some(s => s.value != null);

  if (!hasAnySignal && !dq) {
    return (
      <EmptyState
        icon={Search}
        title="No Discovery Quality Data"
        description="Signal scores are generated during company discovery."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* 4-Signal Dashboard */}
      <SectionHeading title="4-Signal Quality Dashboard" icon={Search}>
        <div className="grid grid-cols-2 gap-3">
          {signals.map((signal) => {
            if (signal.value == null) return null;
            const pct = Math.round(signal.value);
            const color = pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500';
            const bgColor = pct >= 70 ? 'bg-green-50' : pct >= 40 ? 'bg-amber-50' : 'bg-red-50';
            return (
              <Card key={signal.label} className={bgColor}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{signal.label}</span>
                    <span className={`text-lg font-bold ${color}`}>{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-1.5 mt-2" />
                  <p className="text-[10px] text-muted-foreground mt-1.5">{signal.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </SectionHeading>

      {/* Composite Score */}
      {company?.composite_signal_score != null && (
        <>
          <Separator />
          <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Composite Signal Score</p>
              <p className="text-xs text-muted-foreground">Weighted average of all 4 signals</p>
            </div>
            <span className="text-2xl font-bold text-primary">{Math.round(company.composite_signal_score)}%</span>
          </div>
        </>
      )}

      {/* Signal confidence */}
      {company?.signal_confidence && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Confidence:</span>
          <Badge variant={company.signal_confidence === 'high' ? 'default' : 'secondary'} className="text-[10px]">
            {company.signal_confidence}
          </Badge>
        </div>
      )}

      {/* Additional discovery quality data from metadata */}
      {dq && typeof dq === 'object' && (
        <>
          <Separator />
          <SectionHeading title="Discovery Details">
            <div className="space-y-2">
              {Object.entries(dq).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="font-medium">{typeof value === 'number' ? `${value}%` : String(value)}</span>
                </div>
              ))}
            </div>
          </SectionHeading>
        </>
      )}
    </div>
  );
}

// ── Algorithm Transparency Tab ──

interface AlgorithmTransparencyTabProps {
  project: any;
  company: CompanyProfile | null;
  metadata: ProjectMetadata | null;
}

export function AlgorithmTransparencyTab({ project, company, metadata }: AlgorithmTransparencyTabProps) {
  const at = metadata?.algorithm_transparency;

  const steps = [
    {
      step: 1,
      title: 'Company Discovery',
      description: 'Multi-strategy Apollo search using course skills, SOC codes, and industry keywords',
      detail: company?.discovery_source ? `Source: ${company.discovery_source}` : null,
    },
    {
      step: 2,
      title: 'Signal Scoring',
      description: '4-factor scoring: skill match, market signals, department fit, contact quality',
      detail: company?.composite_signal_score != null ? `Composite: ${Math.round(company.composite_signal_score)}%` : null,
    },
    {
      step: 3,
      title: 'Project Generation',
      description: 'AI-generated project scoped to course LOs, company needs, and academic constraints',
      detail: metadata?.ai_model_version ? `Model: ${metadata.ai_model_version}` : project.algorithm_version ? `Version: ${project.algorithm_version}` : null,
    },
    {
      step: 4,
      title: 'Alignment Scoring',
      description: 'LO coverage, feasibility assessment, and final composite scoring',
      detail: project.final_score != null ? `Final Score: ${Math.round(project.final_score * 100)}%` : null,
    },
  ];

  return (
    <div className="space-y-5">
      <SectionHeading title="How This Project Was Generated" icon={Cpu}>
        <div className="space-y-4">
          {steps.map(({ step, title, description, detail }) => (
            <div key={step} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {step}
                </div>
                {step < 4 && <div className="flex-1 w-px bg-border mt-1" />}
              </div>
              <div className="pb-4">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                {detail && <Badge variant="outline" className="text-[10px] mt-1.5">{detail}</Badge>}
              </div>
            </div>
          ))}
        </div>
      </SectionHeading>

      {/* Market Signals Used */}
      {metadata?.market_signals_used && (
        <>
          <Separator />
          <SectionHeading title="Market Signals Used" icon={BarChart3}>
            {Array.isArray(metadata.market_signals_used) ? (
              <div className="flex flex-wrap gap-2">
                {metadata.market_signals_used.map((signal: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">{signal}</Badge>
                ))}
              </div>
            ) : typeof metadata.market_signals_used === 'object' ? (
              <div className="space-y-1.5">
                {Object.entries(metadata.market_signals_used).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionHeading>
        </>
      )}

      {/* Additional transparency data */}
      {at && typeof at === 'object' && (
        <>
          <Separator />
          <SectionHeading title="Algorithm Details">
            <div className="space-y-2 text-xs">
              {Object.entries(at).map(([key, value]) => (
                <div key={key}>
                  <span className="font-medium capitalize">{key.replace(/_/g, ' ')}: </span>
                  <span className="text-muted-foreground">
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </SectionHeading>
        </>
      )}
    </div>
  );
}

// ── Verification Tab ──

interface VerificationTabProps {
  project: any;
  metadata: ProjectMetadata | null;
}

export function VerificationTab({ project, metadata }: VerificationTabProps) {
  const vc = metadata?.verification_checks;

  // Auto-compute verification checks from project data
  const loScore = project.lo_alignment_score != null ? project.lo_alignment_score * 100 : 0;
  const feasScore = project.feasibility_score != null ? project.feasibility_score * 100 : 0;
  const finalScore = project.final_score != null ? project.final_score * 100 : 0;

  const checks = [
    {
      label: 'LO Alignment',
      status: loScore >= 70 ? 'pass' : loScore >= 50 ? 'warning' : 'fail',
      value: `${Math.round(loScore)}%`,
      detail: loScore >= 70 ? 'Strong alignment with course learning objectives' : loScore >= 50 ? 'Moderate alignment — some LOs may not be fully covered' : 'Weak alignment — project may not satisfy course requirements',
    },
    {
      label: 'Feasibility',
      status: feasScore >= 60 ? 'pass' : feasScore >= 40 ? 'warning' : 'fail',
      value: `${Math.round(feasScore)}%`,
      detail: feasScore >= 60 ? 'Project scope and timeline are realistic' : feasScore >= 40 ? 'Some feasibility concerns — may need scope adjustment' : 'High risk of timeline or resource overrun',
    },
    {
      label: 'Timeline Fit',
      status: project.tasks && project.tasks.length <= 10 ? 'pass' : 'warning',
      value: `${project.tasks?.length || 0} tasks`,
      detail: project.tasks && project.tasks.length <= 10 ? 'Task count is manageable within semester' : 'High task count — consider prioritization',
    },
    {
      label: 'Deliverables',
      status: project.deliverables && project.deliverables.length >= 2 ? 'pass' : 'warning',
      value: `${project.deliverables?.length || 0} items`,
      detail: project.deliverables && project.deliverables.length >= 2 ? 'Sufficient deliverables for assessment' : 'Consider adding more concrete deliverables',
    },
    {
      label: 'Skills Coverage',
      status: project.skills && project.skills.length >= 3 ? 'pass' : project.skills && project.skills.length >= 1 ? 'warning' : 'fail',
      value: `${project.skills?.length || 0} skills`,
      detail: project.skills && project.skills.length >= 3 ? 'Good skill diversity for student development' : 'Limited skill exposure — may want broader project scope',
    },
    {
      label: 'Overall Readiness',
      status: finalScore >= 65 ? 'pass' : finalScore >= 45 ? 'warning' : 'fail',
      value: `${Math.round(finalScore)}%`,
      detail: finalScore >= 65 ? 'Project is ready for partnership outreach' : finalScore >= 45 ? 'Viable with some adjustments needed' : 'Significant concerns — review before proceeding',
    },
  ];

  // Merge with any stored verification checks
  const allChecks = vc && Array.isArray(vc) ? [...checks, ...vc] : checks;

  const passCount = allChecks.filter(c => c.status === 'pass').length;
  const warnCount = allChecks.filter(c => c.status === 'warning').length;
  const failCount = allChecks.filter(c => c.status === 'fail').length;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex gap-3 justify-center">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" /> {passCount} Pass
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
          <AlertTriangle className="h-3.5 w-3.5" /> {warnCount} Warning
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-700 text-xs font-medium">
          <XCircle className="h-3.5 w-3.5" /> {failCount} Fail
        </div>
      </div>

      <Separator />

      {/* Check List */}
      <div className="space-y-3">
        {allChecks.map((check, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
            <StatusIcon status={check.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{check.label}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{check.value}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Enhanced Market Intel Tab ──

interface EnhancedMarketIntelTabProps {
  company: CompanyProfile | null;
  metadata: ProjectMetadata | null;
  form1: any;
}

export function EnhancedMarketIntelTab({ company, metadata, form1 }: EnhancedMarketIntelTabProps) {
  const emi = metadata?.enhanced_market_intel;
  const pricing = metadata?.pricing_breakdown;
  const roi = metadata?.estimated_roi;

  const hasData = emi || pricing || roi || company?.buying_intent_signals;

  if (!hasData) {
    return (
      <EmptyState
        icon={LineChart}
        title="No Enhanced Market Intel"
        description="Extended market intelligence is generated alongside project metadata."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Pricing Breakdown */}
      {pricing && (
        <SectionHeading title="Pricing Breakdown" icon={DollarSign}>
          {typeof pricing === 'object' && !Array.isArray(pricing) ? (
            <div className="space-y-2">
              {Object.entries(pricing).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="font-medium">
                    {typeof value === 'number' ? `$${value.toLocaleString()}` : String(value)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{String(pricing)}</p>
          )}
        </SectionHeading>
      )}

      {pricing && (roi || company?.buying_intent_signals) && <Separator />}

      {/* ROI Estimation */}
      {roi && (
        <SectionHeading title="ROI Estimation" icon={TrendingUp}>
          {typeof roi === 'object' && !Array.isArray(roi) ? (
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(roi).map(([key, value]) => (
                <div key={key} className="p-2 rounded border text-xs">
                  <p className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className="font-medium mt-0.5">
                    {typeof value === 'number' ? (key.includes('roi') ? `${value}x` : `$${value.toLocaleString()}`) : String(value)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{String(roi)}</p>
          )}
        </SectionHeading>
      )}

      {(roi || pricing) && company?.buying_intent_signals && <Separator />}

      {/* Buying Intent Signals */}
      {company?.buying_intent_signals && (
        <SectionHeading title="Buying Intent Signals" icon={Target}>
          {Array.isArray(company.buying_intent_signals) ? (
            <div className="space-y-2">
              {company.buying_intent_signals.map((signal: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Zap className="h-3 w-3 text-amber-500 shrink-0" />
                  <span className="text-muted-foreground">
                    {typeof signal === 'string' ? signal : signal.name || signal.category || JSON.stringify(signal)}
                  </span>
                </div>
              ))}
            </div>
          ) : typeof company.buying_intent_signals === 'object' ? (
            <div className="space-y-1.5">
              {Object.entries(company.buying_intent_signals).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </SectionHeading>
      )}

      {/* Extended market intel from metadata */}
      {emi && typeof emi === 'object' && (
        <>
          <Separator />
          <SectionHeading title="Extended Market Intelligence">
            <div className="space-y-2">
              {Object.entries(emi).map(([key, value]) => (
                <div key={key} className="text-xs">
                  <span className="font-medium capitalize">{key.replace(/_/g, ' ')}: </span>
                  <span className="text-muted-foreground">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                </div>
              ))}
            </div>
          </SectionHeading>
        </>
      )}
    </div>
  );
}
