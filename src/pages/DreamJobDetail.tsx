import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, Building2, MapPin, Clock, TrendingUp } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HonestAssessment } from '@/components/analysis/HonestAssessment';
import { GapsList } from '@/components/analysis/GapsList';
import { OverlapsList } from '@/components/analysis/OverlapsList';
import { RecommendationsList } from '@/components/recommendations/RecommendationsList';

// Mock data for demonstration
const mockDreamJob = {
  id: '1',
  title: 'Product Manager',
  company_type: 'tech',
  location: 'San Francisco, CA',
  matchScore: 72,
  estimatedTimeToReady: '4-6 months',
  skillsAligned: 8,
  gapsIdentified: 5,
  requirements: [
    'Lead product strategy and roadmap',
    'Work with engineering and design teams',
    'Analyze user data to inform decisions',
    'Communicate with stakeholders',
    'Prioritize features and manage backlog',
  ],
};

export default function DreamJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  // In a real app, fetch the job data based on jobId
  const job = mockDreamJob;

  const getMatchBadgeVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'outline';
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Back Button & Header */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dream-jobs')}
            className="mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  {job.company_type && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      Big Tech
                    </span>
                  )}
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {job.location}
                    </span>
                  )}
                </div>
              </div>
              
              <Badge variant={getMatchBadgeVariant(job.matchScore)} className="text-lg px-3 py-1">
                <TrendingUp className="h-4 w-4 mr-1" />
                {job.matchScore}% Match
              </Badge>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{job.skillsAligned}</p>
                  <p className="text-sm text-muted-foreground">Skills Aligned</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{job.gapsIdentified}</p>
                  <p className="text-sm text-muted-foreground">Gaps Identified</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{job.estimatedTimeToReady}</p>
                  <p className="text-sm text-muted-foreground">Est. Time to Ready</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Requirements Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Key Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {job.requirements.map((req, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-medium text-primary">
                    {index + 1}
                  </span>
                  {req}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Tabbed Content */}
        <Tabs defaultValue="assessment" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="assessment">Assessment</TabsTrigger>
            <TabsTrigger value="overlaps">Matches</TabsTrigger>
            <TabsTrigger value="gaps">Gaps</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="assessment">
            <HonestAssessment />
          </TabsContent>

          <TabsContent value="overlaps">
            <OverlapsList />
          </TabsContent>

          <TabsContent value="gaps">
            <GapsList />
          </TabsContent>

          <TabsContent value="recommendations">
            <RecommendationsList />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
