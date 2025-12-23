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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExtractedCourse {
  id: string;
  fileName: string;
  status: "pending" | "extracting" | "analyzing" | "complete" | "error";
  title: string;
  code: string;
  semester: string;
  capabilities: string[];
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

      // Extract course info from the analysis
      const capabilities = data.analysis?.capabilities?.map((c: any) => 
        typeof c === "string" ? c : c.name
      ) || [];

      // Try to auto-detect title and code from extracted text
      const extractedText = data.extracted_text || "";
      const titleMatch = extractedText.match(/(?:course|class):\s*([^\n]+)/i) ||
        extractedText.match(/^([A-Z][A-Z0-9\s]+\d{3}[A-Z]?)/m);
      const codeMatch = extractedText.match(/([A-Z]{2,4}\s*\d{3,4}[A-Z]?)/);

      return {
        ...fileItem,
        status: "complete",
        title: titleMatch?.[1]?.trim() || fileItem.title,
        code: codeMatch?.[1]?.trim() || "",
        capabilities: capabilities.slice(0, 8),
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

  // Save all processed courses to database
  const saveAllCourses = async () => {
    const completedFiles = files.filter((f) => f.status === "complete");
    if (completedFiles.length === 0) return;
    
    setIsSaving(true);
    let savedCount = 0;
    
    for (const fileItem of completedFiles) {
      try {
        await createCourse.mutateAsync({
          title: fileItem.title,
          code: fileItem.code || null,
          semester: fileItem.semester || null,
        });
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
            <ScrollArea className="max-h-80">
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
                            <p className="font-medium truncate">{fileItem.title}</p>
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
                              Extracting text from PDF...
                            </p>
                          )}
                          {fileItem.status === "analyzing" && (
                            <p className="text-xs text-primary mt-1 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              AI analyzing capabilities...
                            </p>
                          )}
                          {fileItem.status === "error" && (
                            <p className="text-xs text-destructive mt-1">
                              {fileItem.error}
                            </p>
                          )}
                          {fileItem.capabilities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {fileItem.capabilities.slice(0, 4).map((cap, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {cap.replace(/^Can\s+/i, "").slice(0, 25)}
                                  {cap.length > 25 ? "..." : ""}
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
                  Analyze {pendingCount} {pendingCount === 1 ? "Syllabus" : "Syllabi"}
                </>
              )}
            </Button>
          )}
          {completedCount > 0 && pendingCount === 0 && (
            <Button
              onClick={saveAllCourses}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save All {completedCount} Courses
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
