import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BookOpen, 
  Clock, 
  Target, 
  CheckCircle2, 
  Circle, 
  GraduationCap,
  ChevronRight,
  Layers,
  Lightbulb,
  ArrowLeft
} from 'lucide-react';
import { GeneratedCurriculum } from '@/hooks/useGeneratedCurriculum';
import { cn } from '@/lib/utils';

interface GeneratedCurriculumViewProps {
  curriculum: GeneratedCurriculum;
  onBack?: () => void;
}

const bloomLevelColors: Record<string, string> = {
  remember: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  understand: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  apply: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  analyze: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  evaluate: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  create: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

export function GeneratedCurriculumView({ curriculum, onBack }: GeneratedCurriculumViewProps) {
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);

  const structure = curriculum.curriculum_structure;
  const totalHours = structure.subjects.reduce((sum, s) => sum + s.estimated_hours, 0);
  const progress = curriculum.progress_percentage || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to matches
            </Button>
          )}
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            {curriculum.target_occupation}
          </h2>
          <p className="text-muted-foreground max-w-2xl">
            {structure.curriculum_summary}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{curriculum.total_subjects}</p>
                <p className="text-sm text-muted-foreground">Subjects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{curriculum.total_modules}</p>
                <p className="text-sm text-muted-foreground">Modules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{curriculum.total_learning_objectives}</p>
                <p className="text-sm text-muted-foreground">Objectives</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">~{curriculum.estimated_weeks}</p>
                <p className="text-sm text-muted-foreground">Weeks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      {progress > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Subjects */}
      <ScrollArea className="h-[600px] pr-4">
        <Accordion
          type="multiple"
          value={expandedSubjects}
          onValueChange={setExpandedSubjects}
          className="space-y-4"
        >
          {structure.subjects.map((subject, subjectIndex) => (
            <AccordionItem
              key={subjectIndex}
              value={`subject-${subjectIndex}`}
              className="border rounded-lg bg-card overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center gap-4 text-left w-full pr-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                    {subjectIndex + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{subject.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{subject.modules.length} modules</span>
                      <span>•</span>
                      <span>{subject.estimated_hours}h</span>
                    </div>
                  </div>
                  <div className="hidden sm:flex gap-1">
                    {subject.skills_covered.slice(0, 3).map((skill, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {subject.skills_covered.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{subject.skills_covered.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-sm text-muted-foreground mb-4">{subject.description}</p>
                
                {/* Modules */}
                <div className="space-y-3 ml-4">
                  {subject.modules.map((module, moduleIndex) => (
                    <Card key={moduleIndex} className="bg-muted/30">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start gap-3">
                          <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground" />
                          <div>
                            <CardTitle className="text-base">{module.title}</CardTitle>
                            <CardDescription className="mt-1">
                              {module.description} • {module.estimated_hours}h
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="space-y-2 ml-7">
                          {module.learning_objectives.map((lo, loIndex) => (
                            <div
                              key={loIndex}
                              className="flex items-start gap-2 text-sm"
                            >
                              <Circle className="h-3 w-3 mt-1.5 text-muted-foreground" />
                              <div className="flex-1">
                                <p className="text-foreground">{lo.text}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      'text-xs capitalize',
                                      bloomLevelColors[lo.bloom_level.toLowerCase()] || bloomLevelColors.apply
                                    )}
                                  >
                                    <Lightbulb className="h-3 w-3 mr-1" />
                                    {lo.bloom_level}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    ~{lo.estimated_minutes} min
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </div>
  );
}
