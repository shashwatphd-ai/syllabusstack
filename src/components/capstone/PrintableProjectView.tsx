import { Download, Building2, Mail, Phone, User, Globe, Target, Star, Clock, Zap, CheckCircle2, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { QualityBadge } from './QualityBadge';
import type { CapstoneProject, ProjectForm } from '@/hooks/useCapstoneProjects';

interface PrintableProjectViewProps {
  project: CapstoneProject;
  forms?: ProjectForm | null;
}

export function PrintableProjectView({ project, forms }: PrintableProjectViewProps) {
  const company = project.company_profiles;
  const contact = project.contact as any;
  const form1 = forms?.form1_project_details || {};
  const form2 = forms?.form2_contact_info || {};
  const form3 = forms?.form3_requirements || {};
  const form4 = forms?.form4_timeline || {};
  const milestones = forms?.milestones || [];

  const loScore = project.lo_alignment_score != null ? Math.round(project.lo_alignment_score * 100) : null;
  const feasScore = project.feasibility_score != null ? Math.round(project.feasibility_score * 100) : null;
  const finalScore = project.final_score != null ? Math.round(project.final_score * 100) : null;

  const handleExport = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.getElementById('printable-project');
    if (!element) return;
    html2pdf().set({
      margin: [10, 10, 10, 10],
      filename: `${project.title.replace(/\s+/g, '_')}_Project.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(element).save();
  };

  const contactName = form2.contact_name || contact?.name;
  const contactEmail = form2.contact_email || contact?.email;
  const contactPhone = form2.contact_phone || contact?.phone;
  const contactTitle = form2.contact_title || contact?.title;

  return (
    <div>
      {/* Export button - hidden in print */}
      <div className="flex justify-end mb-4 print:hidden">
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {/* Printable content */}
      <div id="printable-project" className="space-y-6 text-sm bg-white p-6 rounded-lg border print:border-none print:p-0">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground">{project.title}</h1>
              {company && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 shrink-0" />
                  {company.name}
                  {company.sector && company.sector !== 'Unknown' && ` · ${company.sector}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {project.final_score != null && (
                <QualityBadge score={project.final_score} size="lg" />
              )}
            </div>
          </div>

          {/* Score summary row */}
          {(loScore != null || feasScore != null || finalScore != null) && (
            <div className="flex gap-4 text-xs text-muted-foreground pt-1">
              {loScore != null && (
                <span className="inline-flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" /> LO Alignment: {loScore}%
                </span>
              )}
              {feasScore != null && (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Feasibility: {feasScore}%
                </span>
              )}
              {finalScore != null && (
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  <Star className="h-3.5 w-3.5" /> Final Score: {finalScore}%
                </span>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Description */}
        {project.description && (
          <div>
            <h2 className="text-sm font-semibold mb-2">Project Description</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
          </div>
        )}

        {/* Tasks */}
        {Array.isArray(project.tasks) && project.tasks.length > 0 && (
          <>
            <Separator />
            <div>
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Tasks ({project.tasks.length})
              </h2>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-5">
                {(project.tasks as string[]).map((task, i) => (
                  <li key={i} className="leading-relaxed">
                    {typeof task === 'string' ? task : JSON.stringify(task)}
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        {/* Deliverables */}
        {Array.isArray(project.deliverables) && project.deliverables.length > 0 && (
          <>
            <Separator />
            <div>
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Award className="h-4 w-4" /> Deliverables ({project.deliverables.length})
              </h2>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-5">
                {(project.deliverables as string[]).map((d, i) => (
                  <li key={i} className="leading-relaxed">
                    {typeof d === 'string' ? d : JSON.stringify(d)}
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        {/* Skills */}
        {project.skills && project.skills.length > 0 && (
          <>
            <Separator />
            <div>
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Zap className="h-4 w-4" /> Required Skills ({project.skills.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {project.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Contact Information */}
        {(contactName || contactEmail || contactPhone) && (
          <>
            <Separator />
            <div>
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <User className="h-4 w-4" /> Contact Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                {contactName && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 shrink-0" /> {contactName}
                    {contactTitle && ` — ${contactTitle}`}
                  </span>
                )}
                {contactEmail && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {contactEmail}
                  </span>
                )}
                {contactPhone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" /> {contactPhone}
                  </span>
                )}
                {company?.website && (
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 shrink-0" /> {company.website}
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {/* Timeline / Milestones */}
        {Array.isArray(milestones) && milestones.length > 0 && (
          <>
            <Separator />
            <div>
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Timeline
              </h2>
              <div className="space-y-2">
                {milestones.map((milestone: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5 shrink-0">
                      {milestone.week ? `Week ${milestone.week}` : `Phase ${i + 1}`}
                    </span>
                    <span className="text-muted-foreground">
                      {milestone.title || milestone.description || JSON.stringify(milestone)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Scoring Summary */}
        {(loScore != null || feasScore != null || finalScore != null) && (
          <>
            <Separator />
            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <Star className="h-4 w-4" /> Scoring Summary
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {loScore != null && (
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-primary">{loScore}%</p>
                    <p className="text-xs text-muted-foreground mt-1">LO Alignment</p>
                  </div>
                )}
                {feasScore != null && (
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-primary">{feasScore}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Feasibility</p>
                  </div>
                )}
                {finalScore != null && (
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-primary">{finalScore}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Final Score</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <Separator />
        <p className="text-xs text-muted-foreground text-center">
          Generated by SyllabusStack · {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

/** Standalone export button to embed in other views */
export function ExportPDFButton({ project }: { project: CapstoneProject }) {
  const handleExport = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.getElementById('printable-project');
    if (!element) return;
    html2pdf().set({
      margin: [10, 10, 10, 10],
      filename: `${project.title.replace(/\s+/g, '_')}_Project.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(element).save();
  };

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8 print:hidden" onClick={handleExport} title="Export PDF">
      <Download className="h-4 w-4" />
    </Button>
  );
}
