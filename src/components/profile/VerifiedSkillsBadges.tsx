import { useState } from 'react';
import {
  useVerifiedSkills,
  useVerifiedSkillsByCategory,
  useSkillStats,
  VerifiedSkill,
  PROFICIENCY_CONFIG,
  SOURCE_TYPE_CONFIG,
  getProficiencyBadge,
  getSourceTypeInfo,
  calculateOverallSkillLevel,
} from '@/hooks/useVerifiedSkills';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Award,
  CheckCircle2,
  GraduationCap,
  Shield,
  Star,
  TrendingUp,
  ChevronRight,
  Calendar,
  ExternalLink,
  Filter,
  FolderCode,
  PenLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface VerifiedSkillsBadgesProps {
  showAll?: boolean;
  maxDisplay?: number;
  compact?: boolean;
  showStats?: boolean;
  className?: string;
}

/**
 * Display verified skills as visual badges
 */
export function VerifiedSkillsBadges({
  showAll = false,
  maxDisplay = 8,
  compact = false,
  showStats = true,
  className,
}: VerifiedSkillsBadgesProps) {
  const { data: skills, isLoading, error } = useVerifiedSkills();
  const { stats } = useSkillStats();
  const [selectedSkill, setSelectedSkill] = useState<VerifiedSkill | null>(null);
  const [viewMode, setViewMode] = useState<'badges' | 'list'>('badges');

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Failed to load verified skills</p>
        </CardContent>
      </Card>
    );
  }

  if (!skills || skills.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Verified Skills
          </CardTitle>
          <CardDescription>
            Complete assessments to earn verified skill badges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Award className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No verified skills yet. Pass course assessments to earn your first badges.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displaySkills = showAll ? skills : skills.slice(0, maxDisplay);
  const hasMore = !showAll && skills.length > maxDisplay;
  const overallLevel = calculateOverallSkillLevel(skills);

  if (compact) {
    return (
      <div className={cn('flex flex-wrap gap-1.5', className)}>
        {displaySkills.map((skill) => (
          <SkillBadge
            key={skill.id}
            skill={skill}
            compact
            onClick={() => setSelectedSkill(skill)}
          />
        ))}
        {hasMore && (
          <Badge variant="outline" className="cursor-pointer">
            +{skills.length - maxDisplay} more
          </Badge>
        )}
        <SkillDetailDialog
          skill={selectedSkill}
          open={!!selectedSkill}
          onClose={() => setSelectedSkill(null)}
        />
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" />
              Verified Skills
              <Badge variant="secondary" className="ml-2">
                {skills.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Skills verified through assessments and certifications
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'badges' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('badges')}
            >
              Badges
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              List
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b">
            <StatCard
              icon={<Award className="h-4 w-4" />}
              label="Total Skills"
              value={stats.total}
            />
            <StatCard
              icon={<Star className="h-4 w-4" />}
              label="Expert Level"
              value={stats.byProficiency.expert + stats.byProficiency.advanced}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Overall Level"
              value={overallLevel.level}
            />
            <StatCard
              icon={<GraduationCap className="h-4 w-4" />}
              label="From Courses"
              value={stats.bySourceType.course_assessment}
            />
          </div>
        )}

        {viewMode === 'badges' ? (
          <div className="flex flex-wrap gap-2">
            {displaySkills.map((skill) => (
              <SkillBadge
                key={skill.id}
                skill={skill}
                onClick={() => setSelectedSkill(skill)}
              />
            ))}
            {hasMore && (
              <Button variant="outline" size="sm" className="rounded-full">
                +{skills.length - maxDisplay} more
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        ) : (
          <SkillsList
            skills={displaySkills}
            onSelectSkill={setSelectedSkill}
          />
        )}

        <SkillDetailDialog
          skill={selectedSkill}
          open={!!selectedSkill}
          onClose={() => setSelectedSkill(null)}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Individual skill badge component
 */
function SkillBadge({
  skill,
  compact = false,
  onClick,
}: {
  skill: VerifiedSkill;
  compact?: boolean;
  onClick?: () => void;
}) {
  const proficiency = getProficiencyBadge(skill.proficiency_level);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              proficiency.color,
              compact ? 'text-xs py-0.5 px-2' : 'py-1 px-3'
            )}
            onClick={onClick}
          >
            <CheckCircle2 className={cn('mr-1', compact ? 'h-3 w-3' : 'h-4 w-4')} />
            {skill.skill_name}
            {!compact && (
              <span className="ml-1.5 opacity-70">
                {proficiency.label.charAt(0)}
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p className="font-medium">{skill.skill_name}</p>
            <p className="text-muted-foreground">
              {proficiency.label} - {proficiency.description}
            </p>
            {skill.source_name && (
              <p className="text-xs text-muted-foreground mt-1">
                From: {skill.source_name}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Skills list view
 */
function SkillsList({
  skills,
  onSelectSkill,
}: {
  skills: VerifiedSkill[];
  onSelectSkill: (skill: VerifiedSkill) => void;
}) {
  return (
    <div className="space-y-2">
      {skills.map((skill) => {
        const proficiency = getProficiencyBadge(skill.proficiency_level);
        const sourceInfo = getSourceTypeInfo(skill.source_type);

        return (
          <div
            key={skill.id}
            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onSelectSkill(skill)}
          >
            <div className="flex items-center gap-3">
              <div className={cn('w-2 h-8 rounded-full', proficiency.badgeColor)} />
              <div>
                <p className="font-medium">{skill.skill_name}</p>
                <p className="text-xs text-muted-foreground">
                  {skill.source_name || sourceInfo.label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={proficiency.color}>
                {proficiency.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(skill.verified_at), { addSuffix: true })}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Skill detail dialog
 */
function SkillDetailDialog({
  skill,
  open,
  onClose,
}: {
  skill: VerifiedSkill | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!skill) return null;

  const proficiency = getProficiencyBadge(skill.proficiency_level);
  const sourceInfo = getSourceTypeInfo(skill.source_type);

  const SourceIcon = {
    GraduationCap,
    CheckCircle: CheckCircle2,
    FolderCode,
    Award,
    PenLine,
  }[sourceInfo.icon] || GraduationCap;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-full', proficiency.color)}>
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle>{skill.skill_name}</DialogTitle>
              <DialogDescription>Verified Skill Badge</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase">Proficiency</p>
              <Badge className={proficiency.color}>{proficiency.label}</Badge>
              <p className="text-xs text-muted-foreground">{proficiency.description}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase">Verification Type</p>
              <div className="flex items-center gap-2">
                <SourceIcon className="h-4 w-4" />
                <span className="text-sm">{sourceInfo.label}</span>
              </div>
            </div>
          </div>

          {skill.source_name && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase">Source</p>
              <p className="text-sm">{skill.source_name}</p>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Verified {formatDistanceToNow(new Date(skill.verified_at), { addSuffix: true })}
          </div>

          {skill.metadata?.score && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase">Assessment Score</p>
              <div className="flex items-center gap-3">
                <Progress value={skill.metadata.score} className="flex-1" />
                <span className="text-sm font-medium">{Math.round(skill.metadata.score)}%</span>
              </div>
            </div>
          )}

          {skill.evidence_url && (
            <Button variant="outline" className="w-full" asChild>
              <a href={skill.evidence_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Evidence
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Stat card component
 */
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

/**
 * Skills by category component
 */
export function VerifiedSkillsByCategory({ className }: { className?: string }) {
  const { groupedSkills, isLoading, error } = useVerifiedSkillsByCategory();
  const [selectedSkill, setSelectedSkill] = useState<VerifiedSkill | null>(null);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || groupedSkills.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Filter className="h-5 w-5" />
          Skills by Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={groupedSkills[0]?.category}>
          <TabsList className="flex-wrap h-auto gap-1">
            {groupedSkills.map(({ category, count }) => (
              <TabsTrigger key={category} value={category} className="text-xs">
                {category} ({count})
              </TabsTrigger>
            ))}
          </TabsList>
          {groupedSkills.map(({ category, skills }) => (
            <TabsContent key={category} value={category} className="mt-4">
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <SkillBadge
                    key={skill.id}
                    skill={skill}
                    onClick={() => setSelectedSkill(skill)}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
        <SkillDetailDialog
          skill={selectedSkill}
          open={!!selectedSkill}
          onClose={() => setSelectedSkill(null)}
        />
      </CardContent>
    </Card>
  );
}

export default VerifiedSkillsBadges;
