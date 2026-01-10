import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { useCreateCourse } from "@/hooks/useCourses";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Edit2,
  Save,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Full capability object with AI-extracted metadata
interface Capability {
  name: string;
  category: string;
  proficiency_level: string;
}

interface ExtractedCourse {
  id: string;
  fileName: string;
  status: "pending" | "extracting" | "analyzing" | "complete" | "error";
  title: string;
  code: string;
  semester: string;
  credits: number;
  capabilities: Capability[];
  error?: string;
  file: File;
}

interface BulkSyllabusUploaderProps {
  onSuccess?: (courses: ExtractedCourse[]) => void;
  onCancel?: () => void;
}

export function BulkSyllabusUploader({ onSuccess, onCancel }: BulkSyllabusUploaderProps) {
  const [files, setFiles] = useState<ExtractedCourse[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const createCourse = useCreateCourse();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      status: "pending" as const,
      title: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
      code: "",
      semester: "",
      credits: 3, // Default, will be overwritten by AI extraction
      capabilities: [],
      file,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    maxFiles: 20,
    maxSize: 20 * 1024 * 1024, // 20MB per file
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFile = (id: string, updates: Partial<ExtractedCourse>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  // Retry a failed file
  const retryFile = (id: string) => {
    updateFile(id, { status: "pending", error: undefined });
  };

  // Extract a clean title from text with validation
  const extractTitle = (extractedText: string, fileName: string, analysisData?: any): string => {
    // Default to filename-based title
    const fileBasedTitle = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    
    // If AI analysis returned a course title, prefer that (with validation)
    if (analysisData?.course_title) {
      const aiTitle = analysisData.course_title.trim();
      if (aiTitle.length >= 3 && aiTitle.length <= 100) {
        return aiTitle;
      }
    }
    
    // Try multiple regex patterns with length validation
    const patterns = [
      /(?:course\s+title|course\s+name):\s*([^\n]{5,100})/i,
      /(?:class):\s*([^\n]{5,100})/i,
      /^([A-Z]{2,4}\s*\d{3,4}[A-Z]?\s*[-–:]\s*[^\n]{5,80})/m,
    ];
    
    for (const pattern of patterns) {
      const match = extractedText.match(pattern);
      if (match?.[1]) {
        const candidate = match[1].trim();
        // Validate: must be reasonable length and mostly alphabetic
        const letterCount = (candidate.match(/[a-zA-Z]/g) || []).length;
        if (
          candidate.length >= 5 && 
          candidate.length <= 100 && 
          !/^\d+$/.test(candidate) && 
          letterCount > candidate.length * 0.4
        ) {
          return candidate;
        }
      }
    }
    
    return fileBasedTitle;
  };

  // Process a single file - extract text and analyze
  const processFile = async (fileItem: ExtractedCourse): Promise<ExtractedCourse> => {
    try {
      updateFile(fileItem.id, { status: "extracting" });

      // Convert file to base64
      const arrayBuffer = await fileItem.file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // Call the parse-syllabus-document function
      const { data, error } = await supabase.functions.invoke("parse-syllabus-document", {
        body: {
          document_base64: base64,
          file_name: fileItem.fileName,
        },
      });

      if (error) throw error;

      updateFile(fileItem.id, { status: "analyzing" });

      // Extract capabilities with full metadata (not just names)
      const rawCapabilities = data.analysis?.capabilities || [];
      const capabilities: Capability[] = rawCapabilities.map((c: any) => ({
        name: typeof c === "string" ? c : (c.name || c),
        category: typeof c === "object" && c.category ? c.category : "technical",
        proficiency_level: typeof c === "object" && c.proficiency_level ? c.proficiency_level : "intermediate",
      }));

      // Extract title with validation - prefer AI-extracted metadata
      const extractedText = data.extracted_text || "";
      const title = extractTitle(extractedText, fileItem.fileName, data.analysis);
      
      // Use AI-extracted course code, fallback to regex
      const aiCourseCode = data.analysis?.course_code;
      const codeMatch = extractedText.match(/([A-Z]{2,4}\s*\d{3,4}[A-Z]?)/);
      const courseCode = aiCourseCode || codeMatch?.[1]?.trim() || "";
      
      // Use AI-extracted semester and credits
      const semester = data.analysis?.semester || "";
      const credits = data.analysis?.credits || 3;

      return {
        ...fileItem,
        status: "complete",
        title,
        code: courseCode,
        semester,
        credits,
        capabilities: capabilities, // Don't slice - show all capabilities
      };
    } catch (error) {
      console.error(`Error processing ${fileItem.fileName}:`, error);
      return {
        ...fileItem,
        status: "error",
        error: error instanceof Error ? error.message : "Processing failed",
      };
    }
  };

  // Process all files in parallel with concurrency limit
  const processAllFiles = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    const pendingFiles = files.filter((f) => f.status === "pending");
    
    // Process in batches of 3 for rate limiting
    const batchSize = 3;
    const results: ExtractedCourse[] = [...files];
    
    for (let i = 0; i < pendingFiles.length; i += batchSize) {
      const batch = pendingFiles.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processFile));
      
      batchResults.forEach((result) => {
        const index = results.findIndex((r) => r.id === result.id);
        if (index >= 0) results[index] = result;
      });
      
      setFiles([...results]);
    }
    
    setIsProcessing(false);
    
    const successCount = results.filter((f) => f.status === "complete").length;
    const errorCount = results.filter((f) => f.status === "error").length;
    
    if (successCount > 0) {
      toast({
        title: "Processing complete",
        description: `${successCount} syllabi analyzed${errorCount > 0 ? `, ${errorCount} failed` : ""}`,
      });
    }
  };

  // Save all processed courses to database with capabilities
  const saveAllCourses = async () => {
    const completedFiles = files.filter((f) => f.status === "complete");
    if (completedFiles.length === 0) return;
    
    setIsSaving(true);
    let savedCount = 0;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "Not authenticated",
        variant: "destructive",
      });
      setIsSaving(false);
      return;
    }
    
    for (const fileItem of completedFiles) {
      try {
        // Create course with capability names and analysis status
        const capabilityText = fileItem.capabilities.map(c => c.name).join("; ");
        // Cast capabilities to Json-compatible format for Supabase
        const keyCapabilities = fileItem.capabilities.map(cap => ({
          name: cap.name,
          category: cap.category,
          proficiency_level: cap.proficiency_level,
        }));
        const course = await createCourse.mutateAsync({
          title: fileItem.title,
          code: fileItem.code || null,
          semester: fileItem.semester || null,
          credits: fileItem.credits || 3,
          key_capabilities: keyCapabilities as unknown as import('@/integrations/supabase/types').Json,
          capability_text: capabilityText,
          analysis_status: "completed",
        });

        // Save capabilities with AI-extracted metadata
        if (fileItem.capabilities.length > 0) {
          const capabilitiesToInsert = fileItem.capabilities.map(cap => ({
            user_id: user.id,
            course_id: course.id,
            name: cap.name,
            category: cap.category,
            proficiency_level: cap.proficiency_level,
            source: 'course',
          }));

          const { error: capError } = await supabase.from('capabilities').insert(capabilitiesToInsert);
          if (capError) {
            console.error(`Failed to save capabilities for ${fileItem.title}:`, capError);
          }
        }

        savedCount++;
      } catch (error) {
        console.error(`Failed to save ${fileItem.title}:`, error);
      }
    }
    
    setIsSaving(false);
    
    toast({
      title: "Courses saved!",
      description: `${savedCount} courses added to your profile`,
    });
    
    onSuccess?.(completedFiles);
  };

  const completedCount = files.filter((f) => f.status === "complete").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const pendingCount = files.filter((f) => f.status === "pending").length;
  const processingCount = files.filter((f) => 
    f.status === "extracting" || f.status === "analyzing"
  ).length;
  
  const overallProgress = files.length > 0 
    ? ((completedCount + errorCount) / files.length) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn(
          "h-12 w-12 mx-auto mb-4 transition-colors",
          isDragActive ? "text-primary" : "text-muted-foreground"
        )} />
        <h3 className="text-lg font-semibold mb-2">
          {isDragActive ? "Drop your syllabi here" : "Drag & drop up to 20 syllabi"}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          PDF, DOCX, or TXT files • Max 20MB each
        </p>
        <Button variant="outline" type="button">
          Browse Files
        </Button>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {files.length} {files.length === 1 ? "Syllabus" : "Syllabi"}
                {files.length > 4 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    (scroll to see all)
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {completedCount > 0 && (
                  <Badge variant="default" className="bg-green-500">
                    {completedCount} ready
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive">{errorCount} failed</Badge>
                )}
              </div>
            </div>
            {isProcessing && (
              <div className="mt-2">
                <Progress value={overallProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Processing {processingCount} of {files.length}...
                </p>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]" type="always">
              <div className="divide-y">
                {files.map((fileItem) => (
                  <div
                    key={fileItem.id}
                    className="p-4 flex items-start gap-4 hover:bg-muted/50"
                  >
                    {/* Status Icon */}
                    <div className="pt-1">
                      {fileItem.status === "pending" && (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      {(fileItem.status === "extracting" || fileItem.status === "analyzing") && (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      )}
                      {fileItem.status === "complete" && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                      {fileItem.status === "error" && (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      {editingId === fileItem.id ? (
                        <div className="space-y-2">
                          <Input
                            value={fileItem.title}
                            onChange={(e) =>
                              updateFile(fileItem.id, { title: e.target.value })
                            }
                            placeholder="Course Title"
                            className="h-8"
                          />
                          <div className="flex gap-2">
                            <Input
                              value={fileItem.code}
                              onChange={(e) =>
                                updateFile(fileItem.id, { code: e.target.value })
                              }
                              placeholder="Code"
                              className="h-8 w-24"
                            />
                            <Input
                              value={fileItem.semester}
                              onChange={(e) =>
                                updateFile(fileItem.id, { semester: e.target.value })
                              }
                              placeholder="Semester"
                              className="h-8 flex-1"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate max-w-[300px]" title={fileItem.title}>
                              {fileItem.title.length > 50 
                                ? `${fileItem.title.slice(0, 50)}...` 
                                : fileItem.title}
                            </p>
                            {fileItem.status === "complete" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => setEditingId(fileItem.id)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {fileItem.fileName}
                            {fileItem.code && ` • ${fileItem.code}`}
                          </p>
                          {fileItem.status === "extracting" && (
                            <p className="text-xs text-primary mt-1">
                              Extracting text from document...
                            </p>
                          )}
                          {fileItem.status === "analyzing" && (
                            <p className="text-xs text-primary mt-1 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              AI analyzing capabilities...
                            </p>
                          )}
                          {fileItem.status === "error" && (
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-destructive flex-1">
                                {fileItem.error}
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => retryFile(fileItem.id)}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Retry
                              </Button>
                            </div>
                          )}
                          {fileItem.capabilities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {fileItem.capabilities.slice(0, 4).map((cap, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {cap.name.replace(/^Can\s+/i, "").slice(0, 25)}
                                  {cap.name.length > 25 ? "..." : ""}
                                </Badge>
                              ))}
                              {fileItem.capabilities.length > 4 && (
                                <Badge variant="outline" className="text-xs">
                                  +{fileItem.capabilities.length - 4} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Remove Button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFile(fileItem.id)}
                      disabled={isProcessing && fileItem.status !== "pending"}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <Button
              onClick={processAllFiles}
              disabled={isProcessing || isSaving}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze {pendingCount} {pendingCount === 1 ? "File" : "Files"}
                </>
              )}
            </Button>
          )}
          {completedCount > 0 && (
            <Button
              onClick={saveAllCourses}
              disabled={isSaving || isProcessing}
              variant="default"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save {completedCount} {completedCount === 1 ? "Course" : "Courses"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
