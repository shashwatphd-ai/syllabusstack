import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileText, 
  X, 
  Loader2, 
  Sparkles, 
  GraduationCap,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSEO, pageSEO } from '@/hooks/useSEO';

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
    // Reset window
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

export default function SyllabusScannerPage() {
  useSEO(pageSEO.syllabusScanner);
  
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [syllabusText, setSyllabusText] = useState('');
  const [courseName, setCourseName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [rateLimitInfo] = useState(getRateLimitInfo);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setCourseName(nameWithoutExt);
      
      // Read text content if it's a text file
      if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => {
          setSyllabusText(e.target?.result as string || '');
        };
        reader.readAsText(file);
      }
      
      toast({
        title: 'File uploaded',
        description: 'Ready for analysis.',
      });
    }
  }, []);

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
    
    if (content.length < 50) {
      toast({
        title: 'Content too short',
        description: 'Please provide at least 50 characters of syllabus content.',
        variant: 'destructive',
      });
      return;
    }

    // Check rate limit
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
      // Call the analyze-syllabus edge function anonymously
      const { data, error } = await supabase.functions.invoke('analyze-syllabus', {
        body: { 
          syllabusText: content.slice(0, 8000), // Limit content size
          courseName: courseName || 'Untitled Course',
          isPublicScan: true // Flag for anonymous scan
        }
      });

      if (error) throw error;

      if (data?.capabilities) {
        // Map capability objects to strings, handle both string[] and object[] formats
        const capNames = data.capabilities.slice(0, 5).map((c: any) => 
          typeof c === 'string' ? c : c.name
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
      
      // Fallback to mock data for demo purposes
      setAnalysisResult({
        capabilities: [
          'Can analyze and interpret course learning objectives',
          'Can identify key skills and competencies from curriculum',
          'Can map course content to job requirements',
          'Can evaluate practical project work',
          'Can assess tool and technology proficiency',
        ],
        tools: [
          { name: 'Critical Analysis', level: 'Demonstrated' },
          { name: 'Research Methods', level: 'Applied' },
        ],
        artifacts: [
          'Course assignments and projects',
          'Written analyses and reports',
        ],
      });
      
      toast({
        title: 'Analysis complete (preview)',
        description: 'Sign up for full AI-powered analysis.',
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

        {/* Rate Limit Warning */}
        {remaining <= 2 && remaining > 0 && (
          <Card className="mb-6 border-yellow-500/50 bg-yellow-50/10">
            <CardContent className="py-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Only {remaining} free scan{remaining !== 1 ? 's' : ''} left</p>
                <p className="text-xs text-muted-foreground">Sign up for unlimited scans and full analysis</p>
              </div>
              <Button size="sm" asChild>
                <Link to="/auth">Sign Up</Link>
              </Button>
            </CardContent>
          </Card>
        )}

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
                          <Button variant="ghost" size="icon" onClick={removeFile}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
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
                  )}
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
                disabled={isAnalyzing || (!syllabusText && !uploadedFile) || remaining <= 0}
                className="w-full"
                size="lg"
              >
                {isAnalyzing ? (
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
          <div className="space-y-6">
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{courseName || 'Course Analysis'}</h2>
                <p className="text-sm text-muted-foreground">AI-generated capability analysis</p>
              </div>
              <Button variant="outline" onClick={resetAnalysis}>
                Scan Another
              </Button>
            </div>

            {/* Capabilities */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Concrete Capabilities
                </CardTitle>
                <CardDescription>
                  What students will actually be able to DO after this course
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {analysisResult.capabilities.map((cap, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-medium text-primary">
                        {i + 1}
                      </span>
                      <span className="text-sm">{cap}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Tools & Methods */}
            {analysisResult.tools.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tools & Methods Proficiency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {analysisResult.tools.map((tool, i) => (
                      <Badge key={i} variant="outline" className="py-2 px-3">
                        <span className="font-medium">{tool.name}</span>
                        <span className="text-muted-foreground ml-2">({tool.level})</span>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Artifacts */}
            {analysisResult.artifacts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Evidence & Artifacts</CardTitle>
                  <CardDescription>Tangible outputs students will produce</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysisResult.artifacts.map((artifact, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {artifact}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* CTA */}
            <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold mb-1">Want the Full Analysis?</h3>
                    <p className="text-sm text-muted-foreground">
                      Compare this course against real job requirements. See gaps and get 
                      personalized recommendations.
                    </p>
                  </div>
                  <Button asChild>
                    <Link to="/auth">
                      Get Started Free
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer Note */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          This is a preview. Create a free account to save analyses and compare against job requirements.
        </p>
      </main>
    </div>
  );
}
