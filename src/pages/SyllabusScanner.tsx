import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Loader2, 
  Sparkles, 
  GraduationCap,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSEO, pageSEO } from '@/hooks/useSEO';
import { savePendingResults } from '@/lib/pending-results';
import { ScannerDropzone, ScanResultDisplay, RateLimitBanner } from '@/components/scanner';

interface AnalysisResult {
  capabilities: string[];
  tools: { name: string; level: string }[];
  artifacts: string[];
}

// Rate limiting - 5 scans per hour per session
const RATE_LIMIT_KEY = 'syllabus_scanner_rate';
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function getRateLimitInfo(): { remaining: number; resetTime: number } {
  const stored = sessionStorage.getItem(RATE_LIMIT_KEY);
  const now = Date.now();
  
  if (!stored) {
    return { remaining: RATE_LIMIT_MAX, resetTime: now + RATE_LIMIT_WINDOW };
  }
  
  const { count, resetTime } = JSON.parse(stored);
  
  if (now > resetTime) {
    return { remaining: RATE_LIMIT_MAX, resetTime: now + RATE_LIMIT_WINDOW };
  }
  
  return { remaining: Math.max(0, RATE_LIMIT_MAX - count), resetTime };
}

function recordScan(): boolean {
  const now = Date.now();
  const stored = sessionStorage.getItem(RATE_LIMIT_KEY);
  
  let count = 1;
  let resetTime = now + RATE_LIMIT_WINDOW;
  
  if (stored) {
    const data = JSON.parse(stored);
    if (now < data.resetTime) {
      count = data.count + 1;
      resetTime = data.resetTime;
      
      if (count > RATE_LIMIT_MAX) {
        return false;
      }
    }
  }
  
  sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ count, resetTime }));
  return true;
}

// Helper to convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SyllabusScannerPage() {
  useSEO(pageSEO.syllabusScanner);
  const navigate = useNavigate();
  
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [syllabusText, setSyllabusText] = useState('');
  const [courseName, setCourseName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [rateLimitInfo] = useState(getRateLimitInfo);

  const handleSaveResults = () => {
    if (!analysisResult) return;
    
    savePendingResults({
      courseName: courseName || 'Analyzed Course',
      capabilities: analysisResult.capabilities,
      tools: analysisResult.tools,
      artifacts: analysisResult.artifacts,
      scannedAt: new Date().toISOString(),
    });
    
    toast({
      title: 'Results saved!',
      description: 'Create an account to access your analysis anytime.',
    });
    
    navigate('/auth?from=scanner');
  };

  const handleFileAccepted = useCallback(async (file: File) => {
    setUploadedFile(file);
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    setCourseName(nameWithoutExt);
    
    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSyllabusText(e.target?.result as string || '');
      };
      reader.readAsText(file);
      toast({
        title: 'File uploaded',
        description: 'Text extracted and ready for analysis.',
      });
    } else if (file.type === 'application/pdf' || 
               file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      setIsParsing(true);
      try {
        const base64 = await fileToBase64(file);
        
        const { data, error } = await supabase.functions.invoke('parse-syllabus-document', {
          body: { 
            document_base64: base64,
            file_name: file.name,
            isPublicScan: true
          }
        });
        
        if (error) throw error;
        
        const extractedText = data.extracted_text || '';
        if (extractedText.length > 0) {
          setSyllabusText(extractedText);
          toast({
            title: 'Document parsed!',
            description: `Extracted ${extractedText.length} characters from ${file.name}`,
          });
        } else {
          throw new Error('No text could be extracted from the document');
        }
      } catch (error) {
        console.error('PDF parsing error:', error);
        toast({
          title: 'Parsing failed',
          description: error instanceof Error ? error.message : 'Please paste the syllabus content manually.',
          variant: 'destructive',
        });
      } finally {
        setIsParsing(false);
      }
    }
  }, []);

  const handleRemoveFile = () => {
    setUploadedFile(null);
  };

  const handleAnalyze = async () => {
    const content = syllabusText || '';
    
    if (!content && !uploadedFile) {
      toast({
        title: 'Missing content',
        description: 'Please upload a file or paste syllabus text.',
        variant: 'destructive',
      });
      return;
    }
    
    if (isParsing) {
      toast({
        title: 'Still parsing',
        description: 'Please wait for the document to finish parsing.',
        variant: 'destructive',
      });
      return;
    }
    
    if (content.length < 50) {
      toast({
        title: 'Content too short',
        description: 'Please provide at least 50 characters of syllabus content.',
        variant: 'destructive',
      });
      return;
    }

    const { remaining } = getRateLimitInfo();
    if (remaining <= 0) {
      toast({
        title: 'Rate limit reached',
        description: 'You\'ve used all free scans. Sign up for unlimited access!',
        variant: 'destructive',
      });
      return;
    }

    if (!recordScan()) {
      toast({
        title: 'Rate limit exceeded',
        description: 'Please try again later or sign up for unlimited access.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-syllabus', {
        body: { 
          syllabusText: content.slice(0, 8000),
          courseName: courseName || 'Untitled Course',
          isPublicScan: true
        }
      });

      if (error) throw error;

      if (data?.capabilities) {
        const capNames = data.capabilities.slice(0, 5).map((c: unknown) => 
          typeof c === 'string' ? c : (c as { name: string }).name
        );
        
        setAnalysisResult({
          capabilities: capNames || [],
          tools: (data.tools_learned || data.tools_methods || []).slice(0, 5).map((t: string) => ({ 
            name: t, 
            level: 'Covered' 
          })),
          artifacts: (data.course_themes || data.evidence_types || []).slice(0, 5),
        });
      } else {
        throw new Error('Invalid response from AI');
      }

      toast({
        title: 'Analysis complete',
        description: 'Full features available with a free EduThree account.',
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setAnalysisResult(null);
    setUploadedFile(null);
    setSyllabusText('');
    setCourseName('');
  };

  const { remaining } = rateLimitInfo;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">EduThree</span>
            <Badge variant="secondary" className="ml-2">Syllabus Scanner</Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {remaining} scans remaining
            </div>
            <Button variant="outline" asChild>
              <Link to="/auth">Sign Up Free</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-3">
            What Will Students <span className="text-primary">Actually Learn</span>?
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Upload any syllabus and our AI will analyze the concrete capabilities students 
            will develop. Perfect for faculty reviewing courses or students choosing classes.
          </p>
        </div>

        <RateLimitBanner remaining={remaining} />

        {!analysisResult ? (
          <Card>
            <CardHeader>
              <CardTitle>Upload Syllabus</CardTitle>
              <CardDescription>
                Upload a PDF/DOCX or paste the syllabus text directly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Course Name (optional)</label>
                <Input
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g., Introduction to Financial Analysis"
                />
              </div>

              <Tabs defaultValue="paste" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload">Upload File</TabsTrigger>
                  <TabsTrigger value="paste">Paste Text</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-4">
                  <ScannerDropzone
                    uploadedFile={uploadedFile}
                    isParsing={isParsing}
                    onFileAccepted={handleFileAccepted}
                    onRemoveFile={handleRemoveFile}
                  />
                </TabsContent>

                <TabsContent value="paste" className="mt-4">
                  <Textarea
                    value={syllabusText}
                    onChange={(e) => setSyllabusText(e.target.value)}
                    placeholder="Paste your syllabus content here..."
                    className="min-h-[250px] resize-y"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>{syllabusText.length} characters</span>
                    <span>Minimum: 50 characters</span>
                  </div>
                </TabsContent>
              </Tabs>

              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || isParsing || (!syllabusText && !uploadedFile) || remaining <= 0}
                className="w-full"
                size="lg"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Parsing document...
                  </>
                ) : isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze Syllabus
                  </>
                )}
              </Button>
              
              {isAnalyzing && (
                <div className="space-y-2">
                  <Progress value={66} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">
                    AI is extracting capabilities from your syllabus...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <ScanResultDisplay
            courseName={courseName}
            result={analysisResult}
            onReset={resetAnalysis}
            onSave={handleSaveResults}
          />
        )}

        {/* Footer Note */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          This is a preview. Create a free account to save analyses and compare against job requirements.
        </p>
      </main>
    </div>
  );
}
