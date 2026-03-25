/**
 * generate-premium-insights — Generates skill gap analysis and salary projections.
 * Uses O*NET occupation data + demand signals to produce actionable insights.
 * Called by: useGeneratePremiumInsights() hook in the frontend.
 *
 * Body: { project_id: string }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';
import { verifyAuth, unauthorizedResponse } from '../_shared/capstone/auth-middleware.ts';

serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const authResult = await verifyAuth(req);
    if (!authResult.authenticated) {
      return unauthorizedResponse(req, authResult.error || 'Unauthorized');
    }

    const { project_id } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: 'project_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch project + company
    const { data: project, error: pErr } = await supabase
      .from('capstone_projects')
      .select('*, company_profiles(*)')
      .eq('id', project_id)
      .single();

    if (pErr || !project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const company = project.company_profiles;
    const projectSkills: string[] = project.skills || [];

    // 2. Fetch demand signals for skill gap context
    const { data: demandSignals } = await supabase
      .from('demand_signals')
      .select('skill_name, demand_level, salary_range, growth_rate, posting_count')
      .order('posting_count', { ascending: false })
      .limit(50);

    // 3. Build skill gap analysis
    const demandMap = new Map<string, any>();
    (demandSignals || []).forEach((ds: any) => {
      demandMap.set(ds.skill_name.toLowerCase(), ds);
    });

    const companyTech: string[] = company?.technologies_used || [];
    const allRelevantSkills = [...new Set([...projectSkills, ...companyTech])];

    const skillGapAnalysis = allRelevantSkills.map((skill) => {
      const demandInfo = demandMap.get(skill.toLowerCase());
      const isInProject = projectSkills.some(
        (s) => s.toLowerCase() === skill.toLowerCase()
      );
      const isInCompanyStack = companyTech.some(
        (t) => t.toLowerCase() === skill.toLowerCase()
      );

      // Current level: based on whether the capstone project teaches it
      const currentLevel = isInProject ? 65 : 20;
      // Target level: higher if company uses it AND demand is high
      const targetLevel = isInCompanyStack
        ? demandInfo?.demand_level === 'high' || demandInfo?.demand_level === 'critical'
          ? 90
          : 75
        : 60;

      return {
        skill,
        current_level: currentLevel,
        target_level: targetLevel,
        gap: Math.max(0, targetLevel - currentLevel),
        in_project: isInProject,
        in_company_stack: isInCompanyStack,
        demand_level: demandInfo?.demand_level || 'unknown',
        posting_count: demandInfo?.posting_count || 0,
      };
    });

    // Sort by gap descending (biggest gaps first)
    skillGapAnalysis.sort((a, b) => b.gap - a.gap);

    // 4. Build salary projections from demand signals
    const salaryProjections = allRelevantSkills
      .map((skill) => {
        const demandInfo = demandMap.get(skill.toLowerCase());
        if (!demandInfo?.salary_range) return null;
        return {
          skill,
          salary_range: demandInfo.salary_range,
          growth_rate: demandInfo.growth_rate,
          demand_level: demandInfo.demand_level,
          posting_count: demandInfo.posting_count,
        };
      })
      .filter(Boolean);

    // If no demand signal salary data, generate estimates from company info
    if (salaryProjections.length === 0 && company) {
      const revenueRange = company.organization_revenue_range || company.revenue_range;
      const employeeCount = company.employee_count;

      // Rough salary estimation based on company size
      let baseSalary = 55000;
      if (employeeCount) {
        const count = parseInt(employeeCount.replace(/[^\d]/g, ''), 10);
        if (count > 1000) baseSalary = 75000;
        else if (count > 200) baseSalary = 65000;
      }

      const roles = [
        { role: `${project.tier === 'advanced' ? 'Senior ' : ''}${projectSkills[0] || 'Technical'} Specialist`, salary_range: `$${baseSalary.toLocaleString()} - $${(baseSalary + 25000).toLocaleString()}` },
        { role: `${projectSkills[1] || 'Project'} Analyst`, salary_range: `$${(baseSalary - 5000).toLocaleString()} - $${(baseSalary + 15000).toLocaleString()}` },
      ];

      if (project.tier === 'advanced') {
        roles.push({
          role: `${company.sector || 'Industry'} Consultant`,
          salary_range: `$${(baseSalary + 10000).toLocaleString()} - $${(baseSalary + 40000).toLocaleString()}`,
        });
      }

      salaryProjections.push(...roles);
    }

    // 5. Ensure project_metadata row exists
    const { data: existing } = await supabase
      .from('project_metadata')
      .select('id')
      .eq('project_id', project_id)
      .maybeSingle();

    if (!existing) {
      await supabase.from('project_metadata').insert({ project_id });
    }

    // 6. Store results
    const { error: updateErr } = await supabase
      .from('project_metadata')
      .update({
        skill_gap_analysis: skillGapAnalysis,
        salary_projections: salaryProjections,
        updated_at: new Date().toISOString(),
      })
      .eq('project_id', project_id);

    if (updateErr) {
      console.error('[generate-premium-insights] DB update error:', updateErr);
      throw updateErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        skill_gap_analysis: skillGapAnalysis,
        salary_projections: salaryProjections,
        skills_analyzed: allRelevantSkills.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[generate-premium-insights] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate premium insights.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
