import { supabase } from '@/integrations/supabase/client';

export interface Capability {
  name: string;
  category: string;
  proficiency_level: string;
}

export interface AnalyzeSyllabusResponse {
  capabilities: Capability[];
  error?: string;
}

export interface ParseDocumentResponse {
  text: string;
  extracted_text?: string;
  analysis?: {
    capabilities?: Array<{ name: string; category: string } | string>;
    tools_learned?: string[];
    course_themes?: string[];
  };
  metadata?: {
    pages?: number;
    title?: string;
  };
  error?: string;
}

export async function analyzeSyllabus(
  syllabusText: string,
  courseId?: string
): Promise<AnalyzeSyllabusResponse> {
  const { data, error } = await supabase.functions.invoke('analyze-syllabus', {
    body: { syllabusText, courseId }
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function parseSyllabusDocument(file: File): Promise<ParseDocumentResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Upload file to syllabi bucket
  const fileExt = file.name.split('.').pop();
  const filePath = `${user.id}/${Date.now()}-${file.name}`;
  
  const { error: uploadError } = await supabase.storage
    .from('syllabi')
    .upload(filePath, file);
  
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  // 2. Get signed URL
  const { data: urlData, error: urlError } = await supabase.storage
    .from('syllabi')
    .createSignedUrl(filePath, 3600); // 1 hour expiry
  
  if (urlError || !urlData?.signedUrl) {
    throw new Error('Failed to get file URL');
  }

  // 3. Call parse-syllabus-document edge function
  const { data, error } = await supabase.functions.invoke('parse-syllabus-document', {
    body: { 
      document_url: urlData.signedUrl, 
      file_name: file.name 
    }
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);

  // Normalize response - edge function returns extracted_text, map to text for compatibility
  return {
    text: data.extracted_text || data.text || '',
    extracted_text: data.extracted_text,
    analysis: data.analysis,
    metadata: data.metadata,
  };
}
