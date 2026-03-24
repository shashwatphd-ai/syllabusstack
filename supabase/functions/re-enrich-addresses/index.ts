/**
 * Re-Enrich Addresses Edge Function
 * Calls Apollo Organization Enrich API for existing companies to update their full_address.
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";

const APOLLO_API_BASE = 'https://api.apollo.io';

async function enrichAddress(domain: string, apiKey: string): Promise<{
  street_address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
} | null> {
  try {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(`${APOLLO_API_BASE}/v1/organizations/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({ domain: cleanDomain }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const org = data?.organization;
    if (!org) return null;

    return {
      street_address: org.street_address || undefined,
      city: org.city || undefined,
      state: org.state || undefined,
      postal_code: org.postal_code || undefined,
      country: org.country || undefined,
    };
  } catch {
    return null;
  }
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return createErrorResponse('UNAUTHORIZED', corsHeaders);

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) return createErrorResponse('UNAUTHORIZED', corsHeaders);

  const { instructor_course_id } = await req.json();
  if (!instructor_course_id) {
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'instructor_course_id required');
  }

  const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
  if (!APOLLO_API_KEY) {
    return createErrorResponse('CONFIG_ERROR', corsHeaders, 'Apollo API key not configured');
  }

  // Fetch companies with incomplete addresses
  const { data: companies, error } = await supabase
    .from('company_profiles')
    .select('id, name, website, apollo_organization_id, full_address')
    .eq('instructor_course_id', instructor_course_id)
    .not('website', 'is', null);

  if (error || !companies) {
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error?.message);
  }

  console.log(`Re-enriching addresses for ${companies.length} companies...`);

  let updated = 0;
  const results: Array<{ name: string; old: string | null; new: string | null }> = [];

  for (const company of companies) {
    const domain = company.website;
    if (!domain) continue;

    const addr = await enrichAddress(domain, APOLLO_API_KEY);
    if (!addr || (!addr.street_address && !addr.city)) {
      results.push({ name: company.name, old: company.full_address, new: null });
      continue;
    }

    const fullAddress = [addr.street_address, addr.city, addr.state, addr.postal_code]
      .filter(Boolean)
      .join(', ');

    if (fullAddress && fullAddress !== company.full_address) {
      const { error: updateError } = await supabase
        .from('company_profiles')
        .update({ full_address: fullAddress })
        .eq('id', company.id);

      if (!updateError) {
        updated++;
        console.log(`  ✅ ${company.name}: ${fullAddress}`);
        results.push({ name: company.name, old: company.full_address, new: fullAddress });
      }
    }

    // Brief delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`Re-enrichment complete: ${updated}/${companies.length} addresses updated`);

  return createSuccessResponse({
    total: companies.length,
    updated,
    results,
  }, corsHeaders);
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
