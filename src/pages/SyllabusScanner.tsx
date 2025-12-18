import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileText, 
  X, 
  Loader2, 
  Sparkles, 
  GraduationCap,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

// Mock analysis result for demo
const mockAnalysisResult = {
  capabilities: [
    'Can build and interpret financial statements (income, balance sheet, cash flow)',
    'Can perform ratio analysis to assess company financial health',
    'Can create financial models using Excel with VLOOKUP and pivot tables',
    'Can analyze case studies and present strategic recommendations',
    'Can apply discounted cash flow (DCF) valuation methods',
  ],
  tools: [
    { name: 'Microsoft Excel', level: 'Intermediate' },
    { name: 'Financial Modeling', level: 'Beginner' },
    { name: 'Bloomberg Terminal', level: 'Basic Exposure' },
  ],
  artifacts: [
    'Financial analysis report (10-15 pages)',
    'Company valuation model (Excel)',
    'Investment recommendation presentation',
  ],
};

export default function SyllabusScannerPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [syllabusText, setSyllabusText] = useState('');
  const [courseName, setCourseName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<typeof mockAnalysisResult | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setCourseName(nameWithoutExt);
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
    if (!syllabusText && !uploadedFile) {
      toast({
        title: 'Missing content',
        description: 'Please upload a file or paste syllabus text.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    
    // Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    setAnalysisResult(mockAnalysisResult);
    setIsAnalyzing(false);

    toast({
      title: 'Analysis complete',
      description: 'Full features available with a free EduThree account.',
    });
  };

  const resetAnalysis = () => {
    setAnalysisResult(null);
    setUploadedFile(null);
    setSyllabusText('');
    setCourseName('');
  };

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
          <Button variant="outline" asChild>
            <a href="/signup">Sign Up Free</a>
          </Button>
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
                </TabsContent>
              </Tabs>

              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || (!syllabusText && !uploadedFile)}
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

            {/* Artifacts */}
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
                    <a href="/signup">
                      Get Started Free
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </a>
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
