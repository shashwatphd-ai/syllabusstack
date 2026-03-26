/**
 * Import University Data
 * Bulk import university/institution data from Apollo CSV exports.
 * Ported from EduThree1.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

interface UniversityRow {
  "Company Name": string;
  "Company Name for Emails"?: string;
  "Account Stage"?: string;
  "# Employees"?: string;
  Industry?: string;
  Website?: string;
  "Company Linkedin Url"?: string;
  "Company City"?: string;
  "Company State"?: string;
  "Company Country"?: string;
  "Company Postal Code"?: string;
  "Company Address"?: string;
  Keywords?: string;
  "Company Phone"?: string;
  Technologies?: string;
  "Total Funding"?: string;
  "Annual Revenue"?: string;
  "Apollo Account Id"?: string;
  "Short Description"?: string;
  "Founded Year"?: string;
  "Logo Url"?: string;
}

function safeString(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value).trim() || null;
}

function extractDomain(websiteUrl: unknown): string | null {
  if (!websiteUrl) return null;
  try {
    return String(websiteUrl).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase().trim().replace(/\\/g, "") || null;
  } catch { return null; }
}

function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return isNaN(value) ? null : Math.floor(value);
  const num = parseInt(String(value).replace(/[^0-9-]/g, ""), 10);
  return isNaN(num) ? null : num;
}

function transformRow(row: UniversityRow) {
  const domain = extractDomain(row["Website"]);
  const name = safeString(row["Company Name"]);
  if (!domain || !name) return null;

  const city = safeString(row["Company City"]);
  const state = safeString(row["Company State"]);

  return {
    domain, name,
    country: safeString(row["Company Country"]) || "United States",
    city, state,
    zip: safeString(row["Company Postal Code"]),
    formatted_location: safeString(row["Company Address"]) || `${city || ""}, ${state || ""}`.trim() || "Unknown",
    company_name_for_emails: safeString(row["Company Name for Emails"]),
    employee_count: parseNumber(row["# Employees"]),
    industry: safeString(row["Industry"]),
    company_linkedin_url: safeString(row["Company Linkedin Url"])?.replace(/\\/g, ""),
    keywords: safeString(row["Keywords"]),
    company_phone: safeString(row["Company Phone"]),
    technologies: safeString(row["Technologies"]),
    total_funding: safeString(row["Total Funding"]),
    annual_revenue: parseNumber(row["Annual Revenue"]),
    apollo_account_id: safeString(row["Apollo Account Id"]),
    short_description: safeString(row["Short Description"]),
    founded_year: parseNumber(row["Founded Year"]),
    logo_url: safeString(row["Logo Url"])?.replace(/\\/g, ""),
  };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // Auth: verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const { data: roles } = await anonClient
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers });
    }

    const { rows } = await req.json() as { rows: UniversityRow[] };
    if (!rows || !Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: "Invalid request: rows array required" }), { status: 400, headers });
    }

    console.log(`📥 Received ${rows.length} rows for import`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const transformedRows = rows.map(transformRow).filter((r): r is NonNullable<typeof r> => r !== null);

    // Deduplicate by domain
    const uniqueByDomain = new Map<string, (typeof transformedRows)[0]>();
    for (const row of transformedRows) uniqueByDomain.set(row.domain, row);
    const deduplicatedRows = Array.from(uniqueByDomain.values());

    console.log(`🔄 Deduplicated: ${transformedRows.length} → ${deduplicatedRows.length} unique domains`);

    const BATCH_SIZE = 500;
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < deduplicatedRows.length; i += BATCH_SIZE) {
      const batch = deduplicatedRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabaseAdmin
        .from("university_domains")
        .upsert(batch, { onConflict: "domain", ignoreDuplicates: false });

      if (error) {
        console.error(`❌ Batch error:`, error.message);
        errorCount += batch.length;
        errors.push(error.message);
      } else {
        successCount += batch.length;
      }
    }

    console.log(`✅ Import complete: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        totalReceived: rows.length,
        totalTransformed: transformedRows.length,
        totalDeduplicated: deduplicatedRows.length,
        successCount, errorCount,
        errors: errors.slice(0, 10),
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("❌ Import error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: `Import failed: ${message}` }), { status: 500, headers });
  }
});
