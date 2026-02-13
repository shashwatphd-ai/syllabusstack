import { createClient } from "@supabase/supabase-js";
import { unzipSync, strFromU8 } from "npm:fflate@^0.8.2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

/**
 * Parse Syllabus Document
 *
 * This function handles:
 * - PDFs: Uses Gemini for text extraction (OCR capable)
 * - DOCX: Extracts text locally (DOCX is a ZIP; Document AI processors do not accept DOCX MIME types)
 * - Images: Uses Gemini with Vision API fallback
 *
 * The extracted text is then passed to analyze-syllabus for capability extraction.
 */

function base64ToU8(base64: string): Uint8Array {
  const bin = atob(base64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function decodeXmlEntities(text: string): string {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function extractTextFromDocxXml(documentXml: string): string {
  // DOCX WordprocessingML: paragraphs are <w:p> ... </w:p>, text runs are <w:t>...</w:t>
  const paragraphs = documentXml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? [];
  const lines: string[] = [];

  for (const p of paragraphs) {
    const runs = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => decodeXmlEntities(m[1] ?? ""));
    const line = runs.join("").replace(/\s+/g, " ").trim();
    if (line) lines.push(line);
  }

  // Fallback: if no paragraphs matched, just extract all runs
  if (lines.length === 0) {
    const runs = [...documentXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => decodeXmlEntities(m[1] ?? ""));
    return runs.join(" ").replace(/\s+/g, " ").trim();
  }

  return lines.join("\n");
}

function extractDocxTextFromBase64(base64Content: string): string {
  const bytes = base64ToU8(base64Content);
  const files = unzipSync(bytes);
  const documentXmlBytes = files["word/document.xml"];
  if (!documentXmlBytes) {
    throw new Error("Invalid DOCX: missing word/document.xml");
  }
  const documentXml = strFromU8(documentXmlBytes);
  return extractTextFromDocxXml(documentXml);
}


const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const GOOGLE_CLOUD_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
    if (!GOOGLE_CLOUD_API_KEY) {
      return createErrorResponse('CONFIG_ERROR', corsHeaders, 'GOOGLE_CLOUD_API_KEY is not configured');
    }

    const { document_base64, document_url, course_id, file_name, isPublicScan } = await req.json();

    if (!document_base64 && !document_url) {
      throw new Error("Either document_base64 or document_url is required");
    }

    // SSRF Protection for document URLs
    if (document_url) {
      let docUrl: URL;
      try {
        docUrl = new URL(document_url);
      } catch {
        throw new Error("Invalid document URL format");
      }

      const hostname = docUrl.hostname.toLowerCase();

      // Block private IP ranges and localhost
      const blockedPatterns = [
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
        /^192\.168\./,
        /^localhost$/i,
        /^169\.254\./,
        /^::1$/,
        /^fc00:/i,
        /^fe80:/i,
        /^0\./,
        /^\[::1\]$/,
      ];

      if (blockedPatterns.some(pattern => pattern.test(hostname))) {
        throw new Error("Private or internal URLs are not allowed");
      }

      // Only allow https for document URLs
      if (docUrl.protocol !== 'https:') {
        throw new Error("Only HTTPS URLs are allowed for document fetching");
      }

      console.log(`Fetching document from validated URL: ${docUrl.host}`);
    }

    // File size validation for base64 content
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (document_base64) {
      // Estimate decoded size (base64 is ~33% larger than binary)
      const estimatedSize = (document_base64.length * 3) / 4;
      if (estimatedSize > MAX_FILE_SIZE) {
        throw new Error("File too large. Maximum size is 10MB.");
      }
    }

    // For authenticated requests, validate the user
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");

    if (!isPublicScan) {
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

    console.log(`Parsing document${userId ? ` for user ${userId}` : ' (public scan)'}, course: ${course_id || 'new'}, file: ${file_name || 'unknown'}`);

    let base64Content: string;
    let mimeType = "application/pdf";
    let isDocx = false;

    if (document_base64) {
      base64Content = document_base64;
      
      if (file_name) {
        const ext = file_name.toLowerCase().split('.').pop();
        if (ext === 'docx') {
          mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          isDocx = true;
        } else if (ext === 'doc') {
          mimeType = "application/msword";
        } else if (ext === 'png') {
          mimeType = "image/png";
        } else if (ext === 'jpg' || ext === 'jpeg') {
          mimeType = "image/jpeg";
        } else if (ext === 'txt') {
          mimeType = "text/plain";
        }
      }
    } else {
      const docResponse = await fetch(document_url);
      if (!docResponse.ok) {
        throw new Error(`Failed to fetch document: ${docResponse.status}`);
      }
      
      const contentType = docResponse.headers.get("content-type");
      if (contentType) {
        mimeType = contentType;
        if (contentType.includes("wordprocessingml") || contentType.includes("openxmlformats")) {
          isDocx = true;
        }
      }
      
      // Also check URL extension
      if (document_url?.toLowerCase().endsWith('.docx')) {
        isDocx = true;
      }
      
      const buffer = await docResponse.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64Content = btoa(binary);
    }

    let extractedText = "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    // Handle DOCX files (DOCX is not supported by Document AI processors)
    if (isDocx) {
      console.log("Processing DOCX file locally...");

      try {
        extractedText = extractDocxTextFromBase64(base64Content);
        console.log(`Extracted ${extractedText.length} characters from DOCX (local unzip)`);
      } catch (docxError) {
        console.error("DOCX extraction failed:", docxError);
        throw new Error(
          `Failed to extract text from DOCX: ${docxError instanceof Error ? docxError.message : "Unknown error"}`,
        );
      }
    }
    // Handle plain text files
    else if (mimeType === "text/plain") {
      console.log("Processing TXT file...");
      try {
        extractedText = atob(base64Content);
        console.log(`Read ${extractedText.length} characters from TXT`);
      } catch (txtError) {
        // Try UTF-8 decoding
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        extractedText = new TextDecoder().decode(bytes);
        console.log(`Read ${extractedText.length} characters from TXT (UTF-8)`);
      }
    }
    // Handle PDFs and images with Gemini
    else {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_CLOUD_API_KEY}`;
      const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_API_KEY}`;

      const extractionPrompt = mimeType === "application/pdf"
        ? `Extract ALL text content from this syllabus document.

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
        : `Extract ALL text content from this syllabus image using OCR.

Include all visible text:
- Course title and code
- Instructor information
- Course description and objectives
- Weekly schedule and topics
- Assignments and grading
- Any other visible text

Format the extracted text clearly, preserving the document structure.
Do NOT summarize - extract the complete text content.`;

      try {
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
                { text: extractionPrompt }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 16384,
            }
          })
        });

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          console.error("Gemini extraction error:", errorText);
          throw new Error(`Gemini API error: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        extractedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

        console.log(`Extracted ${extractedText.length} characters from ${mimeType} via Gemini`);
      } catch (geminiError) {
        console.error("Gemini extraction failed:", geminiError);

        // Fallback to Vision API for images only
        if (mimeType.startsWith("image/")) {
          console.log("Attempting fallback to Vision API...");

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

            if (visionResponse.status === 403) {
              throw new Error(
                "Image OCR failed: Google Cloud Vision API may not be enabled. " +
                "Please enable the Vision API in Google Cloud Console, or upload a PDF file instead."
              );
            }
            throw new Error(`Failed to extract text from image: ${visionResponse.status}`);
          }

          const visionData = await visionResponse.json();
          extractedText = visionData.responses?.[0]?.fullTextAnnotation?.text || "";

          console.log(`Extracted ${extractedText.length} characters via Vision API fallback`);
        } else {
          throw geminiError;
        }
      }
    }

    if (!extractedText || extractedText.length < 50) {
      throw new Error("Could not extract sufficient text from the document. Please ensure the document contains readable text.");
    }

    // Now call the analyze-syllabus function with the extracted text
    // Pass auth header to ensure user context is preserved for database operations
    const analyzeHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) {
      analyzeHeaders["Authorization"] = authHeader;
    }

    const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-syllabus`, {
      method: "POST",
      headers: analyzeHeaders,
      body: JSON.stringify({
        syllabusText: extractedText,
        courseId: course_id,
      })
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      console.error("analyze-syllabus error:", errorText);
      
      // Return partial success - analysis failed but text was extracted
      // IMPORTANT: success: false signals to frontend that capabilities were NOT extracted
      return new Response(
        JSON.stringify({
          success: false,
          analysisComplete: false,
          extracted_text: extractedText,
          text_length: extractedText.length,
          analysis_error: `Analysis failed: ${analyzeResponse.status}`,
          message: "Text extracted successfully but capability analysis failed. You can retry analysis."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const analysisResult = await analyzeResponse.json();

    logInfo('parse-syllabus-document', 'complete', { textLength: extractedText.length });

    return createSuccessResponse({
      success: true,
      extracted_text: extractedText,
      text_length: extractedText.length,
      analysis: analysisResult,
      message: "Document parsed and analyzed successfully"
    }, corsHeaders);

  } catch (error: unknown) {
    logError('parse-syllabus-document', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
