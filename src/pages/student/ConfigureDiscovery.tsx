import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type Status = 'idle' | 'discovering' | 'generating' | 'completed' | 'failed';

export default function ConfigureDiscovery() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [industries, setIndustries] = useState('');
  const [numTeams, setNumTeams] = useState(5);
  const [status, setStatus] = useState<Status>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollForCompletion = (runId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('capstone_generation_runs')
          .select('status, current_phase, error_details')
          .eq('id', runId)
          .single();

        if (error) throw error;

        if (data.status === 'completed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus('completed');
          setStatusMessage('Projects generated successfully!');
          toast({ title: 'Complete', description: 'Your capstone projects are ready.' });
          setTimeout(() => navigate('/student/capstone-projects'), 1500);
        } else if (data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus('failed');
          const errMsg = typeof data.error_details === 'string'
            ? data.error_details
            : (data.error_details as any)?.message || 'Generation failed.';
          setStatusMessage(errMsg);
        } else {
          setStatusMessage(data.current_phase ? `Phase: ${data.current_phase}` : 'Processing...');
        }
      } catch {
        // Keep polling on transient errors
      }
    }, 3000);
  };

  const handleSubmit = async () => {
    if (!courseId) return;

    const targetIndustries = industries
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    setStatus('discovering');
    setStatusMessage('Discovering companies...');

    try {
      // Step 1: Discover companies
      const { data: discoverData, error: discoverError } = await supabase.functions.invoke('discover-companies', {
        body: {
          instructor_course_id: courseId,
          target_industries: targetIndustries,
          num_teams: numTeams,
        },
      });

      if (discoverError) throw discoverError;
      if (discoverData?.error) throw new Error(discoverData.error);

      // Step 2: Generate capstone projects
      setStatus('generating');
      setStatusMessage('Generating capstone projects...');

      const { data: genData, error: genError } = await supabase.functions.invoke('generate-capstone-projects', {
        body: {
          instructor_course_id: courseId,
          num_teams: numTeams,
        },
      });

      if (genError) throw genError;
      if (genData?.error) throw new Error(genData.error);

      // If we get a run_id, poll for completion; otherwise assume done
      const runId = genData?.run_id;
      if (runId) {
        pollForCompletion(runId);
      } else {
        setStatus('completed');
        setStatusMessage('Projects generated successfully!');
        toast({ title: 'Complete', description: 'Your capstone projects are ready.' });
        setTimeout(() => navigate('/student/capstone-projects'), 1500);
      }
    } catch (err) {
      setStatus('failed');
      setStatusMessage(err instanceof Error ? err.message : 'An error occurred.');
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to generate projects.',
        variant: 'destructive',
      });
    }
  };

  const isProcessing = status === 'discovering' || status === 'generating';

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-primary" />
          Configure Discovery
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set parameters for discovering industry partners and generating projects.
        </p>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Discovery Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Target Industries */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Target Industries</Label>
            <Input
              value={industries}
              onChange={(e) => setIndustries(e.target.value)}
              placeholder="e.g. Technology, Healthcare, Finance"
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list. Leave empty for AI-recommended industries.
            </p>
          </div>

          {/* Number of Teams */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Number of Teams</Label>
              <span className="text-sm font-medium text-primary">{numTeams}</span>
            </div>
            <Slider
              value={[numTeams]}
              onValueChange={([v]) => setNumTeams(v)}
              min={1}
              max={20}
              step={1}
              className="w-full"
              disabled={isProcessing}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isProcessing}
            className="w-full gap-2"
            size="lg"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
            {isProcessing ? 'Processing...' : 'Start Discovery & Generation'}
          </Button>
        </CardContent>
      </Card>

      {/* Progress status */}
      {status !== 'idle' && (
        <Card className={
          status === 'failed' ? 'border-destructive/50' :
          status === 'completed' ? 'border-green-500/50' :
          'border-primary/30'
        }>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              {status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
              {status === 'failed' && <XCircle className="h-5 w-5 text-destructive" />}
              <div>
                <p className="text-sm font-medium">
                  {status === 'discovering' && 'Discovering Companies'}
                  {status === 'generating' && 'Generating Projects'}
                  {status === 'completed' && 'Complete'}
                  {status === 'failed' && 'Failed'}
                </p>
                {statusMessage && (
                  <p className={`text-xs ${status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {statusMessage}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
