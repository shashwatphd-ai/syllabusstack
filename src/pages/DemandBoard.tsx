/**
 * Demand Board — Public marketplace where employers browse demand signals
 * and click "Express Interest" to start a capstone partnership.
 */

import { useState } from 'react';
import {
  TrendingUp, Building2, MapPin, Briefcase, DollarSign, Search,
  Zap, Send, Filter, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useDemandSignals, useExpressInterest } from '@/hooks/useDemandBoard';
import type { DemandSignal } from '@/hooks/useDemandBoard';

function DemandLevelBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const colors: Record<string, string> = {
    high: 'bg-green-500/10 text-green-700 border-green-200',
    medium: 'bg-amber-500/10 text-amber-700 border-amber-200',
    low: 'bg-muted text-muted-foreground',
    critical: 'bg-red-500/10 text-red-700 border-red-200',
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${colors[level.toLowerCase()] || ''}`}>
      {level}
    </Badge>
  );
}

export default function DemandBoard() {
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [selectedSignal, setSelectedSignal] = useState<DemandSignal | null>(null);

  // Express Interest form state
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [preferredTimeline, setPreferredTimeline] = useState('');

  const { data: signals, isLoading } = useDemandSignals({
    search: search || undefined,
    industry: industry || undefined,
    region: region || undefined,
  });
  const expressInterest = useExpressInterest();

  const handleSubmit = () => {
    if (!selectedSignal || !companyName || !contactName || !contactEmail) return;
    expressInterest.mutate(
      {
        demandSignalId: selectedSignal.id,
        companyName,
        contactName,
        contactEmail,
        projectDescription: projectDescription || undefined,
        preferredTimeline: preferredTimeline || undefined,
      },
      {
        onSuccess: () => {
          setSelectedSignal(null);
          setCompanyName('');
          setContactName('');
          setContactEmail('');
          setProjectDescription('');
          setPreferredTimeline('');
        },
      }
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Demand Board
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse in-demand skills and express interest in capstone partnerships
          </p>
        </div>
        <Badge variant="secondary">{signals?.length || 0} Signals</Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search skills, job titles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Industries</SelectItem>
            <SelectItem value="technology">Technology</SelectItem>
            <SelectItem value="healthcare">Healthcare</SelectItem>
            <SelectItem value="finance">Finance</SelectItem>
            <SelectItem value="manufacturing">Manufacturing</SelectItem>
            <SelectItem value="education">Education</SelectItem>
            <SelectItem value="retail">Retail</SelectItem>
          </SelectContent>
        </Select>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-[180px]">
            <MapPin className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Regions</SelectItem>
            <SelectItem value="northeast">Northeast</SelectItem>
            <SelectItem value="southeast">Southeast</SelectItem>
            <SelectItem value="midwest">Midwest</SelectItem>
            <SelectItem value="west">West Coast</SelectItem>
            <SelectItem value="remote">Remote</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Signal Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : !signals?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No demand signals found</p>
            <p className="text-sm mt-1">Try adjusting your filters or check back later.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {signals.map((signal) => (
            <Card key={signal.id} className="flex flex-col hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">{signal.skill_name}</CardTitle>
                  <DemandLevelBadge level={signal.demand_level} />
                </div>
                {signal.job_title && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> {signal.job_title}
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {signal.industry && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Building2 className="h-3 w-3" /> {signal.industry}
                    </span>
                  )}
                  {signal.region && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {signal.region}
                    </span>
                  )}
                  {signal.salary_range && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <DollarSign className="h-3 w-3" /> {signal.salary_range}
                    </span>
                  )}
                  {signal.posting_count != null && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Zap className="h-3 w-3" /> {signal.posting_count} postings
                    </span>
                  )}
                </div>
                {signal.growth_rate != null && (
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-xs font-medium text-green-600">
                      {signal.growth_rate > 0 ? '+' : ''}{signal.growth_rate}% growth
                    </span>
                  </div>
                )}
                <Button
                  size="sm"
                  className="w-full gap-1.5 mt-auto"
                  onClick={() => setSelectedSignal(signal)}
                >
                  <Send className="h-3 w-3" />
                  Express Interest
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Express Interest Dialog */}
      <Dialog open={!!selectedSignal} onOpenChange={(o) => !o && setSelectedSignal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Express Interest</DialogTitle>
            <DialogDescription>
              Partner with a university on a capstone project related to "{selectedSignal?.skill_name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Company Name *"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Your Name *"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
              <Input
                placeholder="Email *"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <Textarea
              placeholder="Briefly describe the project you have in mind (optional)"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              rows={3}
            />
            <Select value={preferredTimeline} onValueChange={setPreferredTimeline}>
              <SelectTrigger>
                <SelectValue placeholder="Preferred Timeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fall_2026">Fall 2026</SelectItem>
                <SelectItem value="spring_2027">Spring 2027</SelectItem>
                <SelectItem value="summer_2027">Summer 2027</SelectItem>
                <SelectItem value="flexible">Flexible</SelectItem>
              </SelectContent>
            </Select>
            {selectedSignal && (
              <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Signal: </span>
                {selectedSignal.skill_name}
                {selectedSignal.industry && ` · ${selectedSignal.industry}`}
                {selectedSignal.region && ` · ${selectedSignal.region}`}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSignal(null)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={expressInterest.isPending || !companyName || !contactName || !contactEmail}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" />
              {expressInterest.isPending ? 'Submitting...' : 'Submit Interest'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
