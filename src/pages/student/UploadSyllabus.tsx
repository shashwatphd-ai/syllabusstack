import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, MapPin, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SESSION_KEY = 'upload-syllabus-form';

interface FormData {
  city: string;
  state: string;
  zip: string;
}

function loadFormData(): FormData {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { city: '', state: '', zip: '' };
}

export default function UploadSyllabus() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<FormData>(loadFormData);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist form data to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(formData));
  }, [formData]);

  // Auto-detect location from email domain
  useEffect(() => {
    if (!user?.email) return;
    const detectLocation = async () => {
      setIsDetecting(true);
      try {
        const { data, error } = await supabase.functions.invoke('detect-location', {
          body: { email: user.email },
        });
        if (!error && data?.city) {
          setFormData(prev => ({
            city: data.city || prev.city,
            state: data.state || prev.state,
            zip: data.zip || prev.zip,
          }));
        }
      } catch {
        // Silent fail - user can enter manually
      } finally {
        setIsDetecting(false);
      }
    };
    detectLocation();
  }, [user?.email]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      toast({ title: 'File too large', description: 'Maximum file size is 10MB.', variant: 'destructive' });
      return;
    }
    if (f.type !== 'application/pdf') {
      toast({ title: 'Invalid file type', description: 'Please upload a PDF file.', variant: 'destructive' });
      return;
    }
    setFile(f);
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
  });

  const handleSubmit = async () => {
    if (!file) {
      toast({ title: 'No file selected', description: 'Please upload a PDF syllabus.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      // Convert file to base64
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const { data, error } = await supabase.functions.invoke('process-syllabus', {
        body: {
          document_base64: base64,
          file_name: file.name,
          location: {
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      sessionStorage.removeItem(SESSION_KEY);
      toast({ title: 'Syllabus processed!', description: 'Review your course data on the next page.' });

      const courseId = data.course_id || data.instructor_course_id;
      if (courseId) {
        navigate(`/student/review-syllabus/${courseId}`);
      }
    } catch (err) {
      toast({
        title: 'Processing failed',
        description: err instanceof Error ? err.message : 'Failed to process syllabus.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="h-6 w-6 text-primary" />
          Upload Syllabus
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your course syllabus to get started with project matching.
        </p>
      </div>

      {/* File upload zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Course Syllabus (PDF)</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isDragActive ? 'Drop your PDF here' : 'Drag & drop a PDF, or click to browse'}
                </p>
                <p className="text-xs text-muted-foreground">Max 10MB</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Location fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location
            {isDetecting && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="city" className="text-sm">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="e.g. Austin"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state" className="text-sm">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => updateField('state', e.target.value)}
                placeholder="e.g. TX"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zip" className="text-sm">ZIP Code</Label>
              <Input
                id="zip"
                value={formData.zip}
                onChange={(e) => updateField('zip', e.target.value)}
                placeholder="e.g. 78701"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Location is auto-detected from your email. Override if needed.
          </p>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!file || isSubmitting}
        className="w-full gap-2"
        size="lg"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {isSubmitting ? 'Processing Syllabus...' : 'Upload & Process'}
      </Button>
    </div>
  );
}
