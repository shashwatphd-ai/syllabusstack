import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Download, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BatchVerificationResult {
  row: number;
  input: string;
  valid: boolean;
  error?: string;
  certificate?: {
    certificate_number: string;
    holder_name: string;
    course_title: string;
    mastery_score: number | null;
    identity_verified: boolean;
    completion_date: string;
  };
}

interface BatchVerificationUploadProps {
  accountId: string;
  apiKey: string;
}

export function BatchVerificationUpload({ accountId, apiKey }: BatchVerificationUploadProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BatchVerificationResult[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  const parseCSV = (text: string): string[] => {
    const lines = text.split('\n').filter(line => line.trim());
    // Skip header if it looks like a header
    const firstLine = lines[0]?.toLowerCase() || '';
    if (firstLine.includes('certificate') || firstLine.includes('token') || firstLine.includes('id')) {
      return lines.slice(1);
    }
    return lines;
  };

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a CSV file.',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setResults([]);
    setProgress(0);
  }, [toast]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile?.name.endsWith('.csv')) {
      setFile(droppedFile);
      setResults([]);
      setProgress(0);
    }
  }, []);

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setResults([]);
    setProgress(0);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      setTotalRows(rows.length);

      if (rows.length === 0) {
        toast({
          title: 'Empty file',
          description: 'The CSV file contains no data to verify.',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      if (rows.length > 100) {
        toast({
          title: 'Too many rows',
          description: 'Maximum 100 verifications per batch. Please split your file.',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      const batchResults: BatchVerificationResult[] = [];

      for (let i = 0; i < rows.length; i++) {
        const input = rows[i].trim().split(',')[0].trim(); // Take first column

        if (!input) {
          batchResults.push({
            row: i + 1,
            input: '',
            valid: false,
            error: 'Empty value',
          });
          setProgress(((i + 1) / rows.length) * 100);
          setResults([...batchResults]);
          continue;
        }

        try {
          const { data, error } = await supabase.functions.invoke('employer-verify-completion', {
            body: {
              certificate_number: input.startsWith('SS-') ? input : undefined,
              share_token: !input.startsWith('SS-') && input.length > 20 ? input : undefined,
            },
            headers: {
              'x-api-key': apiKey,
            },
          });

          if (error) {
            batchResults.push({
              row: i + 1,
              input,
              valid: false,
              error: error.message,
            });
          } else if (data.valid) {
            batchResults.push({
              row: i + 1,
              input,
              valid: true,
              certificate: data.certificate,
            });
          } else {
            batchResults.push({
              row: i + 1,
              input,
              valid: false,
              error: data.error || 'Invalid certificate',
            });
          }
        } catch (err) {
          batchResults.push({
            row: i + 1,
            input,
            valid: false,
            error: 'Verification failed',
          });
        }

        setProgress(((i + 1) / rows.length) * 100);
        setResults([...batchResults]);

        // Small delay to avoid rate limiting
        if (i < rows.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const validCount = batchResults.filter(r => r.valid).length;
      toast({
        title: 'Batch verification complete',
        description: `${validCount} of ${rows.length} certificates verified successfully.`,
      });

    } catch (err) {
      toast({
        title: 'Error processing file',
        description: 'Failed to read the CSV file.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResults = () => {
    if (results.length === 0) return;

    const headers = [
      'Row',
      'Input',
      'Valid',
      'Certificate Number',
      'Holder Name',
      'Course Title',
      'Mastery Score',
      'Identity Verified',
      'Completion Date',
      'Error',
    ];

    const csvRows = results.map(r => [
      r.row,
      r.input,
      r.valid ? 'Yes' : 'No',
      r.certificate?.certificate_number || '',
      r.certificate?.holder_name || '',
      r.certificate?.course_title || '',
      r.certificate?.mastery_score?.toString() || '',
      r.certificate?.identity_verified ? 'Yes' : 'No',
      r.certificate?.completion_date || '',
      r.error || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `verification-results-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const validCount = results.filter(r => r.valid).length;
  const invalidCount = results.filter(r => !r.valid).length;

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Batch Verification
          </CardTitle>
          <CardDescription>
            Upload a CSV file with certificate numbers or share tokens to verify multiple credentials at once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {file ? (
              <div className="space-y-2">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-primary" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setFile(null)}>
                    Remove
                  </Button>
                  <Button size="sm" onClick={processFile} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Verify All
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="font-medium">Drop CSV file here or click to upload</p>
                <p className="text-sm text-muted-foreground">
                  CSV should have certificate numbers or share tokens in the first column
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="batch-upload"
                />
                <Button variant="outline" asChild>
                  <label htmlFor="batch-upload" className="cursor-pointer">
                    Select File
                  </label>
                </Button>
              </div>
            )}
          </div>

          {isProcessing && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {results.length} of {totalRows} processed
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Verification Results</CardTitle>
              <Button variant="outline" size="sm" onClick={downloadResults}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </div>
            <div className="flex gap-4 text-sm">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {validCount} Valid
              </Badge>
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                {invalidCount} Invalid
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Input</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Certificate</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>ID Verified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.row}>
                      <TableCell className="font-mono text-muted-foreground">
                        {result.row}
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-[150px] truncate">
                        {result.input || '-'}
                      </TableCell>
                      <TableCell>
                        {result.valid ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Invalid
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {result.certificate?.certificate_number || '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {result.certificate?.course_title || result.error || '-'}
                      </TableCell>
                      <TableCell>
                        {result.certificate?.mastery_score != null
                          ? `${result.certificate.mastery_score}%`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {result.certificate ? (
                          result.certificate.identity_verified ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                          )
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sample Format */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">CSV Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-1">
            <p className="text-muted-foreground"># Example CSV format:</p>
            <p>certificate_number</p>
            <p>SS-ABC123</p>
            <p>SS-DEF456</p>
            <p>SS-GHI789</p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Maximum 100 rows per batch. Use certificate numbers (SS-XXXXX) or share tokens.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
