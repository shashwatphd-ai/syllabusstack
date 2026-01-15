// Export utilities for PDF and JSON data export

import { supabase } from '@/integrations/supabase/client';

export interface ExportData {
  profile: {
    full_name: string | null;
    email: string | null;
    university: string | null;
    major: string | null;
    graduation_year: number | null;
    student_level: string | null;
  } | null;
  dreamJobs: Array<{
    title: string;
    company_type: string | null;
    location: string | null;
    match_score: number | null;
  }>;
  capabilities: Array<{
    name: string;
    category: string | null;
    proficiency_level: string | null;
    source: string | null;
  }>;
  courses: Array<{
    title: string;
    code: string | null;
    grade: string | null;
    credits: number | null;
  }>;
  gapAnalysis: {
    match_score: number | null;
    readiness_level: string | null;
    honest_assessment: string | null;
    strong_overlaps: unknown[];
    critical_gaps: unknown[];
    priority_gaps: unknown[];
  } | null;
  recommendations: Array<{
    title: string;
    type: string | null;
    priority: string | null;
    status: string | null;
    gap_addressed: string | null;
  }>;
  exportedAt: string;
}

// Fetch all user data for export
export async function fetchExportData(): Promise<ExportData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch all data in parallel
  const [
    profileResult,
    dreamJobsResult,
    capabilitiesResult,
    coursesResult,
    gapAnalysisResult,
    recommendationsResult,
  ] = await Promise.all([
    supabase.from('profiles').select('id, user_id, full_name, email, university, major, student_level, graduation_year, avatar_url, subscription_tier, created_at').eq('user_id', user.id).single(),
    supabase.from('dream_jobs').select('*').eq('user_id', user.id),
    supabase.from('capabilities').select('*').eq('user_id', user.id),
    supabase.from('courses').select('*').eq('user_id', user.id),
    supabase.from('gap_analyses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    supabase.from('recommendations').select('*').eq('user_id', user.id),
  ]);

  const profile = profileResult.data;
  const dreamJobs = dreamJobsResult.data || [];
  const capabilities = capabilitiesResult.data || [];
  const courses = coursesResult.data || [];
  const gapAnalysis = gapAnalysisResult.data?.[0] || null;
  const recommendations = recommendationsResult.data || [];

  return {
    profile: profile ? {
      full_name: profile.full_name,
      email: profile.email,
      university: profile.university,
      major: profile.major,
      graduation_year: profile.graduation_year,
      student_level: profile.student_level,
    } : null,
    dreamJobs: dreamJobs.map(job => ({
      title: job.title,
      company_type: job.company_type,
      location: job.location,
      match_score: job.match_score,
    })),
    capabilities: capabilities.map(cap => ({
      name: cap.name,
      category: cap.category,
      proficiency_level: cap.proficiency_level,
      source: cap.source,
    })),
    courses: courses.map(course => ({
      title: course.title,
      code: course.code,
      grade: course.grade,
      credits: course.credits,
    })),
    gapAnalysis: gapAnalysis ? {
      match_score: gapAnalysis.match_score,
      readiness_level: gapAnalysis.readiness_level,
      honest_assessment: gapAnalysis.honest_assessment,
      strong_overlaps: gapAnalysis.strong_overlaps as unknown[] || [],
      critical_gaps: gapAnalysis.critical_gaps as unknown[] || [],
      priority_gaps: gapAnalysis.priority_gaps as unknown[] || [],
    } : null,
    recommendations: recommendations.map(rec => ({
      title: rec.title,
      type: rec.type,
      priority: rec.priority,
      status: rec.status,
      gap_addressed: rec.gap_addressed,
    })),
    exportedAt: new Date().toISOString(),
  };
}

// Export as JSON file
export function exportAsJSON(data: ExportData, filename: string = 'syllabusstack-export'): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
}

// Generate PDF content as HTML and trigger print
export function exportAsPDF(data: ExportData): void {
  const htmlContent = generatePDFHTML(data);
  
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to export PDF');
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  // Wait for content to load, then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

function generatePDFHTML(data: ExportData): string {
  const completedRecs = data.recommendations.filter(r => r.status === 'completed').length;
  const totalRecs = data.recommendations.length;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SyllabusStack Career Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: 'Segoe UI', system-ui, sans-serif; 
      line-height: 1.6; 
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header { 
      text-align: center; 
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #6366f1;
    }
    .header h1 { 
      font-size: 28px; 
      color: #6366f1; 
      margin-bottom: 8px;
    }
    .header .subtitle { color: #666; font-size: 14px; }
    .section { margin-bottom: 32px; }
    .section-title { 
      font-size: 18px; 
      color: #1a1a1a; 
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e5e5;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .profile-grid { 
      display: grid; 
      grid-template-columns: repeat(2, 1fr); 
      gap: 12px;
    }
    .profile-item { 
      background: #f9fafb; 
      padding: 12px; 
      border-radius: 8px;
    }
    .profile-label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .profile-value { font-weight: 600; }
    .score-badge { 
      display: inline-block;
      background: #6366f1; 
      color: white; 
      padding: 8px 16px; 
      border-radius: 20px;
      font-weight: 600;
      font-size: 18px;
    }
    .gap-card { 
      background: #fef2f2; 
      border-left: 4px solid #ef4444;
      padding: 12px 16px;
      margin-bottom: 12px;
      border-radius: 0 8px 8px 0;
    }
    .overlap-card { 
      background: #f0fdf4; 
      border-left: 4px solid #22c55e;
      padding: 12px 16px;
      margin-bottom: 12px;
      border-radius: 0 8px 8px 0;
    }
    .rec-card { 
      background: #f9fafb; 
      padding: 12px 16px;
      margin-bottom: 12px;
      border-radius: 8px;
      border: 1px solid #e5e5e5;
    }
    .rec-status { 
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    .rec-status.completed { background: #dcfce7; color: #166534; }
    .rec-status.in_progress { background: #fef3c7; color: #92400e; }
    .rec-status.not_started { background: #f3f4f6; color: #374151; }
    .capability-tag {
      display: inline-block;
      background: #e0e7ff;
      color: #3730a3;
      padding: 4px 10px;
      border-radius: 16px;
      font-size: 12px;
      margin: 4px 4px 4px 0;
    }
    .footer { 
      margin-top: 40px; 
      text-align: center; 
      color: #999; 
      font-size: 12px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
    }
    .assessment-text { 
      background: #f9fafb; 
      padding: 16px; 
      border-radius: 8px;
      font-style: italic;
    }
    @media print {
      body { padding: 20px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎓 SyllabusStack Career Report</h1>
    <p class="subtitle">Generated on ${new Date().toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    })}</p>
  </div>

  ${data.profile ? `
  <div class="section">
    <h2 class="section-title">📋 Profile Summary</h2>
    <div class="profile-grid">
      <div class="profile-item">
        <div class="profile-label">Name</div>
        <div class="profile-value">${data.profile.full_name || 'Not set'}</div>
      </div>
      <div class="profile-item">
        <div class="profile-label">Email</div>
        <div class="profile-value">${data.profile.email || 'Not set'}</div>
      </div>
      <div class="profile-item">
        <div class="profile-label">University</div>
        <div class="profile-value">${data.profile.university || 'Not set'}</div>
      </div>
      <div class="profile-item">
        <div class="profile-label">Major</div>
        <div class="profile-value">${data.profile.major || 'Not set'}</div>
      </div>
      <div class="profile-item">
        <div class="profile-label">Student Level</div>
        <div class="profile-value">${data.profile.student_level ? data.profile.student_level.charAt(0).toUpperCase() + data.profile.student_level.slice(1) : 'Not set'}</div>
      </div>
      <div class="profile-item">
        <div class="profile-label">Graduation Year</div>
        <div class="profile-value">${data.profile.graduation_year || 'Not set'}</div>
      </div>
    </div>
  </div>
  ` : ''}

  ${data.dreamJobs.length > 0 ? `
  <div class="section">
    <h2 class="section-title">🎯 Dream Jobs</h2>
    ${data.dreamJobs.map(job => `
      <div class="rec-card">
        <strong>${job.title}</strong>
        ${job.match_score ? `<span class="score-badge" style="float: right;">${job.match_score}%</span>` : ''}
        <div style="color: #666; font-size: 14px; margin-top: 4px;">
          ${[job.company_type, job.location].filter(Boolean).join(' • ') || 'No details'}
        </div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${data.gapAnalysis ? `
  <div class="section">
    <h2 class="section-title">📊 Gap Analysis</h2>
    <div style="text-align: center; margin-bottom: 20px;">
      <span class="score-badge">${data.gapAnalysis.match_score || 0}% Match Score</span>
      <div style="color: #666; margin-top: 8px;">Readiness: ${data.gapAnalysis.readiness_level || 'Not assessed'}</div>
    </div>
    ${data.gapAnalysis.honest_assessment ? `
    <div class="assessment-text">
      "${data.gapAnalysis.honest_assessment}"
    </div>
    ` : ''}
  </div>

  ${(data.gapAnalysis.strong_overlaps as Array<{student_capability?: string; job_requirement?: string}>).length > 0 ? `
  <div class="section">
    <h2 class="section-title">✅ Your Strengths</h2>
    ${(data.gapAnalysis.strong_overlaps as Array<{student_capability?: string; job_requirement?: string}>).slice(0, 5).map(overlap => `
      <div class="overlap-card">
        <strong>${overlap.student_capability || 'Skill'}</strong>
        <div style="color: #666; font-size: 14px;">Matches: ${overlap.job_requirement || 'Job requirement'}</div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${(data.gapAnalysis.critical_gaps as Array<{job_requirement?: string; impact?: string}>).length > 0 ? `
  <div class="section">
    <h2 class="section-title">⚠️ Critical Gaps</h2>
    ${(data.gapAnalysis.critical_gaps as Array<{job_requirement?: string; impact?: string}>).slice(0, 5).map(gap => `
      <div class="gap-card">
        <strong>${gap.job_requirement || 'Skill gap'}</strong>
        ${gap.impact ? `<div style="color: #666; font-size: 14px;">${gap.impact}</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  ` : ''}

  ${data.capabilities.length > 0 ? `
  <div class="section">
    <h2 class="section-title">💪 Your Capabilities (${data.capabilities.length})</h2>
    <div>
      ${data.capabilities.slice(0, 20).map(cap => `
        <span class="capability-tag">${cap.name}</span>
      `).join('')}
      ${data.capabilities.length > 20 ? `<span class="capability-tag">+${data.capabilities.length - 20} more</span>` : ''}
    </div>
  </div>
  ` : ''}

  ${data.recommendations.length > 0 ? `
  <div class="section">
    <h2 class="section-title">📝 Recommendations (${completedRecs}/${totalRecs} completed)</h2>
    ${data.recommendations.slice(0, 10).map(rec => `
      <div class="rec-card">
        <span class="rec-status ${rec.status || 'not_started'}">${(rec.status || 'not started').replace('_', ' ')}</span>
        <strong style="margin-left: 8px;">${rec.title}</strong>
        ${rec.gap_addressed ? `<div style="color: #666; font-size: 13px; margin-top: 4px;">Addresses: ${rec.gap_addressed}</div>` : ''}
      </div>
    `).join('')}
    ${data.recommendations.length > 10 ? `<p style="color: #666; font-size: 14px;">...and ${data.recommendations.length - 10} more recommendations</p>` : ''}
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated by SyllabusStack • ${data.exportedAt}</p>
    <p>This report contains your career planning data as of the export date.</p>
  </div>
</body>
</html>
  `;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
