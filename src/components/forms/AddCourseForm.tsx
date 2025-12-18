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
  AlertCircle
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

export const addCourseSchema = z.object({
  name: z.string().min(1, 'Course name is required').max(200),
  code: z.string().optional(),
  university: z.string().optional(),
  semester: z.string().optional(),
  syllabusText: z.string().optional(),
}).refine(
  (data) => data.syllabusText && data.syllabusText.length > 50,
  { message: 'Please provide syllabus content (at least 50 characters)', path: ['syllabusText'] }
);

export type AddCourseFormValues = z.infer<typeof addCourseSchema>;

interface AddCourseFormProps {
  onSubmit?: (data: AddCourseFormValues) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function AddCourseForm({ onSubmit, onCancel, isSubmitting = false }: AddCourseFormProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'extracting' | 'analyzing' | 'complete'>('idle');

  const form = useForm({
    defaultValues: {
      name: '',
      code: '',
      university: '',
      semester: '',
      syllabusText: '',
    },
    onSubmit: async ({ value }) => {
      const result = addCourseSchema.safeParse(value);
      if (!result.success) {
        return;
      }
      setAnalysisStatus('extracting');

      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        setAnalysisStatus('analyzing');
        
        if (onSubmit) {
          await onSubmit(value);
        }
        
        setAnalysisStatus('complete');
        
        toast({
          title: "Course added!",
          description: "AI analysis will be performed when Lovable Cloud is enabled.",
        });

        form.reset();
        setUploadedFile(null);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to add course. Please try again.",
          variant: "destructive",
        });
      } finally {
        setAnalysisStatus('idle');
      }
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      form.setFieldValue('name', nameWithoutExt);
      
      toast({
        title: "File uploaded",
        description: "Text extraction will work when Lovable Cloud is enabled.",
      });
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
  };

  const isProcessing = isSubmitting || analysisStatus !== 'idle';

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
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{uploadedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(uploadedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={removeFile}
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

      {isProcessing && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="space-y-3">
              <AnalysisStep
                label="Extracting syllabus content"
                status={analysisStatus === 'extracting' ? 'loading' : analysisStatus !== 'idle' ? 'complete' : 'pending'}
              />
              <AnalysisStep
                label="Analyzing capabilities with AI"
                status={analysisStatus === 'analyzing' ? 'loading' : analysisStatus === 'complete' ? 'complete' : 'pending'}
              />
              <AnalysisStep
                label="Generating capability profile"
                status={analysisStatus === 'complete' ? 'complete' : 'pending'}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, formIsSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isProcessing || formIsSubmitting}>
              {isProcessing ? (
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
