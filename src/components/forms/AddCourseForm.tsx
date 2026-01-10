import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { getFieldError, FormFieldWrapper } from '@/lib/tanstack-form';
import { supabase } from '@/integrations/supabase/client';

// Capability interface matching the analysis result
export interface AnalyzedCapability {
  name: string;
  category: string;
  proficiency_level: string;
}

// Complete analysis result from parse-syllabus-document
export interface CourseAnalysisResult {
  extractedText: string;
  capabilities: AnalyzedCapability[];
  courseTitle?: string;
  courseCode?: string;
  semester?: string;
  credits?: number;
}

export const addCourseSchema = z.object({
  name: z.string().min(1, 'Course name is required').max(200),
  code: z.string().optional(),
  university: z.string().optional(),
  semester: z.string().optional(),
  syllabusText: z.string().optional(),
});

export type AddCourseFormValues = z.infer<typeof addCourseSchema>;

// Extended form values that include the analysis result
export interface AddCourseSubmitData extends AddCourseFormValues {
  analysisResult?: CourseAnalysisResult;
}

interface AddCourseFormProps {
  onSubmit?: (data: AddCourseSubmitData) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function AddCourseForm({ onSubmit, onCancel, isSubmitting = false }: AddCourseFormProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'extracting' | 'analyzing' | 'complete' | 'error'>('idle');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  // Store the complete analysis result for submission
  const [analysisResult, setAnalysisResult] = useState<CourseAnalysisResult | null>(null);

  const form = useForm({
    defaultValues: {
      name: '',
      code: '',
      university: '',
      semester: '',
      syllabusText: '',
    },
    onSubmit: async ({ value }) => {
      // Validate that we have syllabus content
      if (!value.syllabusText || value.syllabusText.length < 50) {
        toast({
          title: "Error",
          description: "Please provide syllabus content (at least 50 characters)",
          variant: "destructive",
        });
        return;
      }

      try {
        if (onSubmit) {
          // Pass the complete analysis result along with form values
          await onSubmit({
            ...value,
            analysisResult: analysisResult || undefined,
          });
        }

        toast({
          title: "Course added!",
          description: analysisResult?.capabilities?.length
            ? `${analysisResult.capabilities.length} skills extracted from your syllabus.`
            : "Your course has been added.",
        });

        form.reset();
        setUploadedFile(null);
        setExtractedText(null);
        setAnalysisResult(null);
        setAnalysisStatus('idle');
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to add course. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const processUploadedFile = async (file: File) => {
    setIsProcessingFile(true);
    setAnalysisStatus('extracting');
    setAnalysisResult(null);

    try {
      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
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
          file_name: file.name,
        },
      });

      if (error) throw error;

      const text = data.extracted_text || data.text || '';
      if (text.length < 50) {
        throw new Error("Could not extract sufficient text from the document.");
      }

      setExtractedText(text);
      form.setFieldValue('syllabusText', text);

      // Extract and store the complete analysis result
      const rawCapabilities = data.analysis?.capabilities || [];
      const capabilities: AnalyzedCapability[] = rawCapabilities.map((c: any) => ({
        name: typeof c === "string" ? c : (c.name || c),
        category: typeof c === "object" && c.category ? c.category : "technical",
        proficiency_level: typeof c === "object" && c.proficiency_level ? c.proficiency_level : "intermediate",
      }));

      // Store the complete analysis result for submission
      const result: CourseAnalysisResult = {
        extractedText: text,
        capabilities,
        courseTitle: data.analysis?.course_title,
        courseCode: data.analysis?.course_code,
        semester: data.analysis?.semester,
        credits: data.analysis?.credits,
      };
      setAnalysisResult(result);

      // Auto-fill course metadata from AI analysis if available
      if (data.analysis?.course_title) {
        form.setFieldValue('name', data.analysis.course_title);
      }
      if (data.analysis?.course_code) {
        form.setFieldValue('code', data.analysis.course_code);
      }
      if (data.analysis?.semester) {
        form.setFieldValue('semester', data.analysis.semester);
      }

      setAnalysisStatus('complete');

      const capCount = capabilities.length;
      toast({
        title: "File processed!",
        description: capCount > 0
          ? `Extracted ${capCount} skills from your syllabus. Review and submit.`
          : "Syllabus text extracted. You can now add the course.",
      });
    } catch (error) {
      console.error('Error processing file:', error);
      setAnalysisStatus('error');
      setAnalysisResult(null);
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Failed to extract text from file.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingFile(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      form.setFieldValue('name', nameWithoutExt);
      setExtractedText(null);
      setAnalysisResult(null);
      setAnalysisStatus('idle');

      // Auto-process the file
      processUploadedFile(file);
    }
  }, [form]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const removeFile = () => {
    setUploadedFile(null);
    setExtractedText(null);
    setAnalysisResult(null);
    setAnalysisStatus('idle');
    form.setFieldValue('syllabusText', '');
  };

  const isProcessing = isSubmitting || isProcessingFile;
  const hasContent = Boolean(extractedText || form.getFieldValue('syllabusText'));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <form.Field
          name="name"
          validators={{
            onBlur: z.string().min(1, 'Course name is required').max(200),
          }}
        >
          {(field) => (
            <FormFieldWrapper
              label="Course Name *"
              htmlFor="name"
              error={getFieldError(field.state.meta.errors)}
              touched={field.state.meta.isTouched}
            >
              <Input
                id="name"
                placeholder="e.g., Introduction to Marketing"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </FormFieldWrapper>
          )}
        </form.Field>

        <form.Field name="code">
          {(field) => (
            <FormFieldWrapper
              label="Course Code"
              htmlFor="code"
              error={getFieldError(field.state.meta.errors)}
              touched={field.state.meta.isTouched}
            >
              <Input
                id="code"
                placeholder="e.g., MKT 101"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </FormFieldWrapper>
          )}
        </form.Field>

        <form.Field name="university">
          {(field) => (
            <FormFieldWrapper
              label="University"
              htmlFor="university"
              error={getFieldError(field.state.meta.errors)}
              touched={field.state.meta.isTouched}
            >
              <Input
                id="university"
                placeholder="e.g., State University"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </FormFieldWrapper>
          )}
        </form.Field>

        <form.Field name="semester">
          {(field) => (
            <FormFieldWrapper
              label="Semester"
              htmlFor="semester"
              error={getFieldError(field.state.meta.errors)}
              touched={field.state.meta.isTouched}
            >
              <Input
                id="semester"
                placeholder="e.g., Fall 2024"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </FormFieldWrapper>
          )}
        </form.Field>
      </div>

      <div className="space-y-4">
        <label className="text-sm font-medium">Syllabus Content *</label>
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload File</TabsTrigger>
            <TabsTrigger value="paste">Paste Text</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            {uploadedFile ? (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        {isProcessingFile ? (
                          <Loader2 className="h-5 w-5 text-primary animate-spin" />
                        ) : analysisStatus === 'complete' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : analysisStatus === 'error' ? (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <FileText className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{uploadedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {isProcessingFile ? (
                            <span className="flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              Extracting text...
                            </span>
                          ) : analysisStatus === 'complete' ? (
                            <span className="text-green-600">Ready to submit</span>
                          ) : analysisStatus === 'error' ? (
                            <span className="text-destructive">Extraction failed - try another file</span>
                          ) : (
                            `${(uploadedFile.size / 1024).toFixed(1)} KB`
                          )}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={removeFile}
                      disabled={isProcessingFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  isDragActive 
                    ? "border-primary bg-primary/5" 
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm font-medium mb-1">
                  {isDragActive ? "Drop your syllabus here" : "Drag & drop your syllabus"}
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, DOCX, or TXT (max 10MB)
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="paste" className="mt-4">
            <form.Field name="syllabusText">
              {(field) => (
                <FormFieldWrapper
                  error={getFieldError(field.state.meta.errors)}
                  touched={field.state.meta.isTouched}
                  description="The more detail you include, the better we can analyze your capabilities."
                >
                  <Textarea
                    id="syllabusText"
                    placeholder="Paste your syllabus content here..."
                    className="min-h-[250px] resize-y"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </FormFieldWrapper>
              )}
            </form.Field>
          </TabsContent>
        </Tabs>
      </div>

      {isSubmitting && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="space-y-3">
              <AnalysisStep
                label="Creating course record"
                status="loading"
              />
              <AnalysisStep
                label="Analyzing capabilities with AI"
                status="pending"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
        )}
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, formIsSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isProcessing || formIsSubmitting || !hasContent}
            >
              {isProcessingFile ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing file...
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analyzing...
                </>
              ) : (
                'Add Course'
              )}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

interface AnalysisStepProps {
  label: string;
  status: 'pending' | 'loading' | 'complete' | 'error';
}

function AnalysisStep({ label, status }: AnalysisStepProps) {
  return (
    <div className="flex items-center gap-3">
      {status === 'pending' && (
        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
      )}
      {status === 'loading' && (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      )}
      {status === 'complete' && (
        <CheckCircle2 className="h-5 w-5 text-green-500" />
      )}
      {status === 'error' && (
        <AlertCircle className="h-5 w-5 text-destructive" />
      )}
      <span className={cn(
        "text-sm",
        status === 'pending' && "text-muted-foreground",
        status === 'loading' && "text-foreground font-medium",
        status === 'complete' && "text-muted-foreground",
        status === 'error' && "text-destructive"
      )}>
        {label}
      </span>
    </div>
  );
}
