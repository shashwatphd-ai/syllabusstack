import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Parse Syllabus Document using Google Cloud Document AI
 * 
 * This function uses Google Cloud Document AI to extract text from uploaded
 * PDF syllabi with high accuracy, including OCR for scanned documents and
 * proper table/structure extraction.
 * 
 * The extracted text is then passed to the analyze-syllabus function for
 * capability extraction using Lovable AI (cheaper for LLM tasks).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_CLOUD_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
    if (!GOOGLE_CLOUD_API_KEY) {
      throw new Error("GOOGLE_CLOUD_API_KEY is not configured");
    }

    // Get the request body - expects base64 encoded PDF or file URL
    const { document_base64, document_url, course_id, file_name, isPublicScan } = await req.json();

    if (!document_base64 && !document_url) {
      throw new Error("Either document_base64 or document_url is required");
    }

    // For authenticated requests, validate the user
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");

    if (!isPublicScan) {
      // Require auth for non-public scans
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

      if (userError || !user) {
        console.error("Auth error:", userError?.message);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = user.id;
    }


    console.log(`Parsing document${userId ? ` for user ${userId}` : ' (public scan)'}, course: ${course_id || 'new'}`);


    let base64Content: string;
    let mimeType = "application/pdf";

    if (document_base64) {
      // Direct base64 content provided
      base64Content = document_base64;
      
      // Detect mime type from file extension if provided
      if (file_name) {
        const ext = file_name.toLowerCase().split('.').pop();
        if (ext === 'docx') mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        else if (ext === 'doc') mimeType = "application/msword";
        else if (ext === 'png') mimeType = "image/png";
        else if (ext === 'jpg' || ext === 'jpeg') mimeType = "image/jpeg";
      }
    } else {
      // Fetch document from URL
      const docResponse = await fetch(document_url);
      if (!docResponse.ok) {
        throw new Error(`Failed to fetch document: ${docResponse.status}`);
      }
      
      const contentType = docResponse.headers.get("content-type");
      if (contentType) mimeType = contentType;
      
      const buffer = await docResponse.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      // Convert to base64
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64Content = btoa(binary);
    }

    // Use Google Cloud Vision API for OCR (part of Document AI but simpler to call)
    // This works well for PDFs, images, and scanned documents
    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_API_KEY}`;
    
    // For PDFs, we need to use Document AI's document processing
    // For images and simple PDFs, Vision API works well
    let extractedText = "";

    if (mimeType === "application/pdf") {
      // Use Gemini for PDF text extraction (it handles PDFs directly)
      // This is more cost-effective than Document AI for simple text extraction
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_CLOUD_API_KEY}`;
      
      const geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Content
                }
              },
              {
                text: `Extract ALL text content from this syllabus document. 
                
Include:
- Course title and code
- Instructor information
- Course description and objectives
- Weekly schedule and topics
- Assignments and grading criteria
- Required textbooks and materials
- Learning outcomes

Format the extracted text clearly, preserving the document structure.
Do NOT summarize - extract the complete text content.`
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1, // Low temperature for accurate extraction
            maxOutputTokens: 16384, // Allow long documents
          }
        })
      });

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error("Gemini PDF extraction error:", errorText);
        throw new Error(`Failed to extract text from PDF: ${geminiResponse.status}`);
      }

      const geminiData = await geminiResponse.json();
      extractedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      console.log(`Extracted ${extractedText.length} characters from PDF`);
    } else {
      // For images, use Vision API OCR
      const visionResponse = await fetch(visionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Content },
            features: [
              { type: "DOCUMENT_TEXT_DETECTION", maxResults: 50 }
            ]
          }]
        })
      });

      if (!visionResponse.ok) {
        const errorText = await visionResponse.text();
        console.error("Vision API error:", errorText);
        throw new Error(`Failed to extract text from image: ${visionResponse.status}`);
      }

      const visionData = await visionResponse.json();
      extractedText = visionData.responses?.[0]?.fullTextAnnotation?.text || "";
      
      console.log(`Extracted ${extractedText.length} characters via OCR`);
    }

    if (!extractedText || extractedText.length < 50) {
      throw new Error("Could not extract sufficient text from the document. Please ensure the document contains readable text.");
    }

    // Now call the analyze-syllabus function with the extracted text
    // This uses Lovable AI (cheaper for LLM tasks)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-syllabus`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // No auth header needed - analyze-syllabus has verify_jwt = false
      },
      body: JSON.stringify({
        syllabusText: extractedText,
        courseId: course_id,
      })
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      console.error("analyze-syllabus error:", errorText);
      
      // Return partial success with just the extracted text
      return new Response(
        JSON.stringify({
          success: true,
          extracted_text: extractedText,
          text_length: extractedText.length,
          analysis_error: `Analysis failed: ${analyzeResponse.status}`,
          message: "Text extracted successfully but analysis failed. You can retry analysis with the extracted text."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const analysisResult = await analyzeResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        extracted_text: extractedText,
        text_length: extractedText.length,
        analysis: analysisResult,
        message: "Document parsed and analyzed successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in parse-syllabus-document:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
