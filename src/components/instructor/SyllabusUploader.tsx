import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useProcessSyllabus } from '@/hooks/useProcessSyllabus';

interface SyllabusUploaderProps {
  courseId: string;
  onSuccess?: () => void;
}

type ProcessingStep = 'idle' | 'uploading' | 'extracting' | 'analyzing' | 'saving' | 'complete' | 'error';

const STEP_LABELS: Record<ProcessingStep, string> = {
  idle: 'Ready to upload',
  uploading: 'Uploading document...',
  extracting: 'Extracting text from PDF...',
  analyzing: 'AI analyzing course structure...',
  saving: 'Saving modules & learning objectives...',
  complete: 'Processing complete!',
  error: 'Processing failed',
};

const STEP_PROGRESS: Record<ProcessingStep, number> = {
  idle: 0,
  uploading: 15,
  extracting: 35,
  analyzing: 65,
  saving: 85,
  complete: 100,
  error: 0,
};

export function SyllabusUploader({ courseId, onSuccess }: SyllabusUploaderProps) {
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const processSyllabus = useProcessSyllabus();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setErrorMessage(null);
      setStep('idle');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20MB
  });

  const handleProcess = async () => {
    if (!selectedFile) return;

    try {
      setErrorMessage(null);
      setStep('uploading');

      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Extract base64 part after data:mime;base64,
          const base64Content = result.split(',')[1];
          resolve(base64Content);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      setStep('extracting');

      // Small delay for UI feedback
      await new Promise(r => setTimeout(r, 300));
      setStep('analyzing');

      // Call the unified process-syllabus function
      const result = await processSyllabus.mutateAsync({
        documentBase64: base64,
        instructorCourseId: courseId,
        fileName: selectedFile.name,
      });

      setStep('saving');
      await new Promise(r => setTimeout(r, 300));
      
      setStep('complete');
      
      // Call success callback after a moment
      setTimeout(() => {
        onSuccess?.();
      }, 1500);

    } catch (error) {
      console.error('Processing error:', error);
      setStep('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process syllabus');
    }
  };

  const resetUploader = () => {
    setSelectedFile(null);
    setStep('idle');
    setErrorMessage(null);
  };

  const isProcessing = step !== 'idle' && step !== 'complete' && step !== 'error';

  return (
    <Card className="border-dashed border-2 border-muted-foreground/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Syllabus Processor
        </CardTitle>
        <CardDescription>
          Upload your syllabus PDF and we'll automatically create modules and learning objectives
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'idle' && !selectedFile && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            {isDragActive ? (
              <p className="text-primary font-medium">Drop your syllabus here...</p>
            ) : (
              <>
                <p className="font-medium text-foreground">Drag & drop your syllabus PDF</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse (PDF, DOCX • max 20MB)</p>
              </>
            )}
          </div>
        )}

        {selectedFile && step === 'idle' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <FileText className="h-8 w-8 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={resetUploader}>
                Remove
              </Button>
            </div>

            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">What happens next:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">1</span>
                  Extract text from your syllabus
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">2</span>
                  AI identifies course modules/units
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">3</span>
                  Extract learning objectives for each module
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">4</span>
                  Save everything to your course
                </li>
              </ul>
            </div>

            <Button 
              onClick={handleProcess} 
              className="w-full gap-2"
              size="lg"
            >
              <Sparkles className="h-4 w-4" />
              Process Syllabus with AI
            </Button>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <div className="flex-1">
                <p className="font-medium">{STEP_LABELS[step]}</p>
                <Progress value={STEP_PROGRESS[step]} className="mt-2" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              This usually takes 10-30 seconds depending on syllabus length
            </p>
          </div>
        )}

        {step === 'complete' && processSyllabus.data && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg border border-success/30">
              <CheckCircle className="h-6 w-6 text-success" />
              <div className="flex-1">
                <p className="font-medium text-success">Syllabus processed successfully!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Created {processSyllabus.data.module_count} modules with {processSyllabus.data.lo_count} learning objectives
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {processSyllabus.data.modules?.map((module: { id: string; title: string }) => (
                <Badge key={module.id} variant="secondary">
                  {module.title}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/30">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Processing failed</p>
                <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
              </div>
            </div>
            <Button variant="outline" onClick={resetUploader} className="w-full">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
