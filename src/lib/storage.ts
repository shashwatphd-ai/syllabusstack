// SyllabusStack Storage Utilities
// Handles file upload/download for syllabi

import { supabase } from '@/integrations/supabase/client';

const SYLLABI_BUCKET = 'syllabi';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadResult {
  path: string;
  url: string;
}

/**
 * Upload a syllabus file to storage
 * Files are stored in user-specific folders: {userId}/{filename}
 */
export async function uploadSyllabus(file: File, userId: string): Promise<UploadResult> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
  }

  // Validate file type
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Allowed: PDF, DOC, DOCX, TXT');
  }

  // Generate unique filename
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${userId}/${timestamp}_${sanitizedName}`;

  // Upload file
  const { data, error } = await supabase.storage
    .from(SYLLABI_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get public URL (signed for private bucket)
  const { data: urlData } = await supabase.storage
    .from(SYLLABI_BUCKET)
    .createSignedUrl(data.path, 60 * 60 * 24 * 7); // 7 days

  return {
    path: data.path,
    url: urlData?.signedUrl || ''
  };
}

/**
 * Get a signed URL for a syllabus file
 */
export async function getSyllabusUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SYLLABI_BUCKET)
    .createSignedUrl(path, 60 * 60); // 1 hour

  if (error) {
    console.error('Get URL error:', error);
    throw new Error(`Failed to get file URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Delete a syllabus file from storage
 */
export async function deleteSyllabus(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(SYLLABI_BUCKET)
    .remove([path]);

  if (error) {
    console.error('Delete error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Download syllabus file content as text
 * Used for AI analysis
 */
export async function downloadSyllabusAsText(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SYLLABI_BUCKET)
    .download(path);

  if (error) {
    console.error('Download error:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }

  // For text files, read directly
  if (path.endsWith('.txt')) {
    return await data.text();
  }

  // For other file types, we'll need to process them
  // This will be handled by a parse-document edge function
  throw new Error('Non-text files require the parse-document edge function');
}

/**
 * List all syllabi for a user
 */
export async function listUserSyllabi(userId: string): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(SYLLABI_BUCKET)
    .list(userId);

  if (error) {
    console.error('List error:', error);
    throw new Error(`Failed to list files: ${error.message}`);
  }

  return data.map(file => `${userId}/${file.name}`);
}
