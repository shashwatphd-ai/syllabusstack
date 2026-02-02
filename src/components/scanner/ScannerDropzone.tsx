import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ScannerDropzoneProps {
  uploadedFile: File | null;
  isParsing: boolean;
  onFileAccepted: (file: File) => void;
  onRemoveFile: () => void;
}

export function ScannerDropzone({
  uploadedFile,
  isParsing,
  onFileAccepted,
  onRemoveFile,
}: ScannerDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      onFileAccepted(file);
    }
  }, [onFileAccepted]);

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

  if (uploadedFile) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                {isParsing ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <FileText className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">{uploadedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {isParsing ? 'Parsing document...' : `${(uploadedFile.size / 1024).toFixed(1)} KB`}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onRemoveFile} disabled={isParsing} aria-label="Remove file">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
        isDragActive
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50'
      )}
    >
      <input {...getInputProps()} />
      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
      <p className="text-sm font-medium mb-1">
        {isDragActive ? 'Drop your syllabus here' : 'Drag & drop your syllabus'}
      </p>
      <p className="text-xs text-muted-foreground">PDF, DOCX, or TXT (max 10MB)</p>
    </div>
  );
}
