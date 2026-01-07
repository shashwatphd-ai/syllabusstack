import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useCreateCourse } from '@/hooks/useCourses';
import { analyzeSyllabus, parseSyllabusDocument } from '@/services';

const courseSchema = z.object({
  name: z.string().min(1, 'Course name is required').max(200),
  code: z.string().optional(),
  university: z.string().optional(),
  semester: z.string().optional(),
  syllabusText: z.string().optional(),
}).refine(
  (data) => data.syllabusText && data.syllabusText.length > 50,
  { message: 'Please provide syllabus content (at least 50 characters)', path: ['syllabusText'] }
);

type CourseFormValues = z.infer<typeof courseSchema>;

export interface CourseData extends CourseFormValues {
  id?: string;
}

interface CourseUploaderProps {
  onSuccess?: (course: CourseData) => void;
  onCancel?: () => void;
  onProcessingStart?: () => void;
}

export function CourseUploader({ onSuccess, onCancel, onProcessingStart }: CourseUploaderProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'parsing' | 'saving' | 'extracting' | 'analyzing' | 'complete'>('idle');

  const createCourse = useCreateCourse();

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      name: '',
      code: '',
      university: '',
      semester: '',
      syllabusText: '',
    },
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      // Auto-fill course name from filename
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      form.setValue('name', nameWithoutExt);
      
      // Handle different file types
      if (file.type === 'text/plain') {
        // Read text file content directly
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          form.setValue('syllabusText', text);
        };
        reader.readAsText(file);
      } else if (file.type === 'application/pdf' || 
                 file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // Parse PDF/DOCX files using edge function
        setIsParsing(true);
        setAnalysisStatus('parsing');
        try {
          const result = await parseSyllabusDocument(file);
          form.setValue('syllabusText', result.text);
          toast({
            title: "Document parsed!",
            description: `Extracted ${result.text.length} characters from ${file.name}`,
          });
        } catch (error) {
          console.error('PDF parsing error:', error);
          toast({
            title: "Parsing failed",
            description: error instanceof Error ? error.message : "Please paste the syllabus content manually.",
            variant: "destructive",
          });
        } finally {
          setIsParsing(false);
          setAnalysisStatus('idle');
        }
      } else {
        toast({
          title: "Unsupported format",
          description: "Please upload a PDF, DOCX, or TXT file.",
          variant: "destructive",
        });
      }
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
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const onSubmit = async (data: CourseFormValues) => {
    setIsAnalyzing(true);
    setAnalysisStatus('saving');
    onProcessingStart?.();

    try {
      // Step 1: Create course in database
      const course = await createCourse.mutateAsync({
        title: data.name,
        code: data.code || null,
        semester: data.semester || null,
      });

      setAnalysisStatus('extracting');

      // Step 2: Call AI analysis with syllabus text
      if (data.syllabusText) {
        setAnalysisStatus('analyzing');
        try {
          await analyzeSyllabus(data.syllabusText, course.id);
        } catch (aiError) {
          console.error('AI analysis error:', aiError);
          // Don't fail the whole flow if AI analysis fails
          toast({
            title: "Course saved",
            description: "Course was added but AI analysis encountered an issue. You can retry later.",
            variant: "default",
          });
        }
      }

      setAnalysisStatus('complete');
      
      toast({
        title: "Course added!",
        description: `${data.name} has been added and analyzed.`,
      });

      // Reset form
      form.reset();
      setUploadedFile(null);

      onSuccess?.({ ...data, id: course.id });
    } catch (error) {
      console.error('Course creation error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add course. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      setAnalysisStatus('idle');
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Course Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Introduction to Marketing" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Code</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., MKT 101" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="university"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>University</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., State University" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="semester"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Semester</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Fall 2024" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Syllabus Upload */}
          <div className="space-y-4">
            <FormLabel>Syllabus Content *</FormLabel>
            <Tabs defaultValue="paste" className="w-full">
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
                <FormField
                  control={form.control}
                  name="syllabusText"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Paste your syllabus content here...

Include:
• Course objectives and learning outcomes
• Topics covered each week
• Assignments and projects
• Required readings and materials
• Grading breakdown"
                          className="min-h-[250px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The more detail you include, the better we can analyze your capabilities.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Analysis Progress */}
          {(isAnalyzing || isParsing) && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <AnalysisStep
                    label="Parsing document content"
                    status={analysisStatus === 'parsing' ? 'loading' : ['saving', 'extracting', 'analyzing', 'complete'].includes(analysisStatus) ? 'complete' : 'pending'}
                  />
                  <AnalysisStep
                    label="Saving course to your profile"
                    status={analysisStatus === 'saving' ? 'loading' : ['extracting', 'analyzing', 'complete'].includes(analysisStatus) ? 'complete' : 'pending'}
                  />
                  <AnalysisStep
                    label="Extracting syllabus content"
                    status={analysisStatus === 'extracting' ? 'loading' : ['analyzing', 'complete'].includes(analysisStatus) ? 'complete' : 'pending'}
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

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isParsing || isAnalyzing}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isAnalyzing || isParsing}>
              {isParsing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Parsing...
                </>
              ) : isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analyzing...
                </>
              ) : (
                'Add Course'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
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