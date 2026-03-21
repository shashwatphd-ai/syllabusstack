import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Auth check
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email } = await req.json();
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const domain = email.split("@")[1].toLowerCase();
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // ── Phase 1: Local DB cache lookup ──
    const { data: cached } = await serviceClient
      .from("university_domains")
      .select("*")
      .eq("domain", domain)
      .maybeSingle();

    if (cached?.city && cached?.state) {
      console.log(`[detect-location] Phase 1 HIT: ${domain} → ${cached.city}, ${cached.state}`);
      return new Response(JSON.stringify({
        success: true,
        city: cached.city,
        state: cached.state,
        zip: cached.zip,
        country: cached.country,
        universityName: cached.name,
        searchLocation: cached.formatted_location || `${cached.city}, ${cached.state}`,
        source: "cache",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Phase 2: Hipo University Domains API → Google Geocoding ──
    let universityName: string | null = null;
    let country: string | null = null;

    try {
      const hipoUrl = `https://universities.hipolabs.com/search?domain=${domain}`;
      const hipoRes = await fetch(hipoUrl, { signal: AbortSignal.timeout(5000) });
      if (hipoRes.ok) {
        const universities = await hipoRes.json();
        if (universities.length > 0) {
          universityName = universities[0].name;
          country = universities[0].alpha_two_code || universities[0].country;
          console.log(`[detect-location] Phase 2 Hipo: ${domain} → ${universityName} (${country})`);
        }
      }
    } catch (e) {
      console.warn(`[detect-location] Phase 2 Hipo failed for ${domain}:`, e.message);
    }

    // If Hipo found a name, geocode it
    const googleApiKey = Deno.env.get("GOOGLE_CLOUD_API_KEY");
    if (!googleApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: "Google Cloud API key not configured",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let geocodeResult: { city: string; state: string; zip: string; country: string; lat: number; lng: number; formatted: string } | null = null;

    if (universityName) {
      geocodeResult = await geocodeAddress(universityName, googleApiKey);
    }

    // ── Phase 3: Fallback — geocode domain prefix + "university" ──
    if (!geocodeResult) {
      // Try domain without TLD as search term + "university"
      const domainParts = domain.replace(/\.(edu|ac\.\w+|org)$/i, '').split('.');
      const fallbackQuery = `${domainParts.join(' ')} university`;
      console.log(`[detect-location] Phase 3 fallback: geocoding "${fallbackQuery}"`);
      geocodeResult = await geocodeAddress(fallbackQuery, googleApiKey);
    }
    }

    if (!geocodeResult) {
      return new Response(JSON.stringify({
        success: false,
        error: "Could not determine location from email domain",
        domain,
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache result for future lookups
    const formattedLocation = [geocodeResult.city, geocodeResult.state, geocodeResult.zip]
      .filter(Boolean)
      .join(", ");

    await serviceClient.from("university_domains").upsert({
      domain,
      name: universityName,
      city: geocodeResult.city,
      state: geocodeResult.state,
      zip: geocodeResult.zip,
      country: geocodeResult.country || country,
      formatted_location: formattedLocation,
      latitude: geocodeResult.lat,
      longitude: geocodeResult.lng,
      updated_at: new Date().toISOString(),
    }, { onConflict: "domain" });

    console.log(`[detect-location] Resolved & cached: ${domain} → ${formattedLocation}`);

    return new Response(JSON.stringify({
      success: true,
      city: geocodeResult.city,
      state: geocodeResult.state,
      zip: geocodeResult.zip,
      country: geocodeResult.country || country,
      universityName,
      searchLocation: formattedLocation,
      source: universityName ? "hipo+google" : "google_fallback",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[detect-location] Error:", err);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: err.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Google Geocoding helper ──
async function geocodeAddress(
  query: string,
  apiKey: string
): Promise<{ city: string; state: string; zip: string; country: string; lat: number; lng: number; formatted: string } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();

    if (data.status !== "OK" || !data.results?.length) {
      console.warn(`[geocode] No results for "${query}": ${data.status}`);
      return null;
    }

    const result = data.results[0];
    const components = result.address_components || [];

    let city = "";
    let state = "";
    let zip = "";
    let countryCode = "";

    for (const comp of components) {
      const types: string[] = comp.types || [];
      if (types.includes("locality")) {
        city = comp.long_name;
      } else if (types.includes("administrative_area_level_1")) {
        state = comp.short_name;
      } else if (types.includes("postal_code")) {
        zip = comp.long_name;
      } else if (types.includes("country")) {
        countryCode = comp.short_name;
      }
    }

    // Fallback for city
    if (!city) {
      const sub = components.find((c: any) =>
        c.types?.includes("sublocality") || c.types?.includes("administrative_area_level_2")
      );
      if (sub) city = sub.long_name;
    }

    const loc = result.geometry?.location;

    return {
      city,
      state,
      zip,
      country: countryCode,
      lat: loc?.lat || 0,
      lng: loc?.lng || 0,
      formatted: result.formatted_address || "",
    };
  } catch (e) {
    console.error(`[geocode] Error geocoding "${query}":`, e.message);
    return null;
  }
}
