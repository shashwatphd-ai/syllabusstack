import { useState, useMemo, useCallback } from "react";
import { Search, Sparkles, Loader2, GraduationCap, AlertCircle, RefreshCw, Filter, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { CourseCard } from "./CourseCard";
import { useCourseSearch, CourseResult } from "@/hooks/useCourseSearch";
import { useGapAnalysis } from "@/hooks/useAnalysis";
import { useDreamJobs } from "@/hooks/useDreamJobs";

interface PriorityGap {
  gap: string;
  priority: number;
  reason: string;
}

interface CriticalGap {
  job_requirement: string;
  student_status: string;
  impact: string;
}

interface CourseDiscoveryProps {
  dreamJobId?: string;
}

export function CourseDiscovery({ dreamJobId }: CourseDiscoveryProps) {
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [priceFilter, setPriceFilter] = useState<string>("all");
  const [freeFirst, setFreeFirst] = useState<boolean>(true);
  
  const { data: dreamJobs } = useDreamJobs();
  const { data: gapAnalysis, isLoading: gapsLoading } = useGapAnalysis(dreamJobId || '');
  const { searchCourses, isSearching, results, reset } = useCourseSearch();
  
  const selectedJob = dreamJobs?.find(j => j.id === dreamJobId);
  
  // Extract gaps from gap analysis
  const priorityGaps = (gapAnalysis?.priority_gaps as PriorityGap[] | undefined) || [];
  const criticalGaps = (gapAnalysis?.critical_gaps as CriticalGap[] | undefined) || [];
  
  const hasGaps = priorityGaps.length > 0 || criticalGaps.length > 0;
  
  // Transform gaps for the search function
  const gapsForSearch = priorityGaps.length > 0 
    ? priorityGaps.map(g => ({ gap: g.gap, priority: g.priority }))
    : criticalGaps.slice(0, 3).map(g => ({ gap: g.job_requirement }));
  
  const handleSearch = useCallback(() => {
    if (!dreamJobId || !selectedJob) return;
    
    searchCourses({
      gaps: gapsForSearch,
      dreamJobId,
      dreamJobTitle: selectedJob.title,
    });
  }, [dreamJobId, selectedJob, gapsForSearch, searchCourses]);
  
  // Filter results
  const filteredResults = useMemo(() => {
    let filtered = results.filter(course => {
      if (providerFilter !== "all" && course.provider !== providerFilter) return false;
      if (priceFilter === "free" && course.price?.toLowerCase() !== "free") return false;
      if (priceFilter === "paid" && course.price?.toLowerCase() === "free") return false;
      return true;
    });
    
    // Sort: free first if enabled
    if (freeFirst) {
      filtered = filtered.sort((a, b) => {
        const aFree = a.price?.toLowerCase() === "free" ? 0 : 1;
        const bFree = b.price?.toLowerCase() === "free" ? 0 : 1;
        return aFree - bFree;
      });
    }
    
    return filtered;
  }, [results, providerFilter, priceFilter, freeFirst]);
  
  // Get unique providers from results
  const providers = [...new Set(results.map(c => c.provider))];
  
  // Count free vs paid
  const freeCount = results.filter(c => c.price?.toLowerCase() === "free").length;
  const paidCount = results.length - freeCount;
  
  if (!dreamJobId) {
    return (
      <Card className="p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <GraduationCap className="h-12 w-12 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">Select a Dream Job</h3>
            <p className="text-muted-foreground">
              Choose a dream job to discover relevant courses for your skill gaps.
            </p>
          </div>
        </div>
      </Card>
    );
  }
  
  if (gapsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }
  
  if (!hasGaps) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Skill Gaps Found</AlertTitle>
        <AlertDescription>
          Run a gap analysis for "{selectedJob?.title}" first to identify skills you need to develop.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Header Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Discover Courses with AI
                </CardTitle>
              <CardDescription className="mt-2">
                  Search Khan Academy, MIT OCW, YouTube, Coursera, Udemy & more for courses matching your skill gaps
                </CardDescription>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {gapsForSearch.length} gaps to address
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Skill gaps preview */}
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Searching courses for:</p>
              <div className="flex flex-wrap gap-2">
                {gapsForSearch.slice(0, 5).map((gap, i) => (
                  <Badge key={i} variant="outline" className="bg-background">
                    {gap.gap?.slice(0, 50)}{(gap.gap?.length || 0) > 50 ? '...' : ''}
                  </Badge>
                ))}
                {gapsForSearch.length > 5 && (
                  <Badge variant="outline">+{gapsForSearch.length - 5} more</Badge>
                )}
              </div>
            </div>
            
            <Button 
              onClick={handleSearch} 
              disabled={isSearching}
              size="lg"
              className="w-full sm:w-auto"
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching courses...
                </>
              ) : results.length > 0 ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Search Again
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Find Courses
                </>
              )}
            </Button>
          </CardContent>
        </div>
      </Card>
      
      {/* Results Section */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Results Header with Filters */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">
                  Found {results.length} Courses
                </h3>
                <p className="text-sm text-muted-foreground">
                  {freeCount} free, {paidCount} paid • Saved to recommendations
                </p>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {/* Free First Toggle - prominent */}
                <div className="flex items-center gap-2 bg-success/10 px-3 py-1.5 rounded-lg border border-success/30">
                  <Leaf className="h-4 w-4 text-success" />
                  <Switch 
                    id="free-first"
                    checked={freeFirst}
                    onCheckedChange={setFreeFirst}
                  />
                  <Label htmlFor="free-first" className="text-sm text-success cursor-pointer">
                    Free First
                  </Label>
                </div>
                
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {providers.map(provider => (
                      <SelectItem key={provider} value={provider}>
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={priceFilter} onValueChange={setPriceFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Price" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Prices</SelectItem>
                    <SelectItem value="free">Free Only</SelectItem>
                    <SelectItem value="paid">Paid Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Course Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredResults.map((course, index) => (
              <CourseCard
                key={`${course.url}-${index}`}
                title={course.title}
                provider={course.provider}
                url={course.url}
                description={course.description}
                duration={course.duration}
                rating={course.rating}
                price={course.price}
                priority={index < 3 ? 'high' : index < 6 ? 'medium' : 'low'}
                isSaved={true}
              />
            ))}
          </div>
          
          {filteredResults.length === 0 && results.length > 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No courses match your filters</p>
              <Button 
                variant="link" 
                onClick={() => { setProviderFilter("all"); setPriceFilter("all"); }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Loading State */}
      {isSearching && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-full" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
