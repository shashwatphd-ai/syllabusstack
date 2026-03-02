import { memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ProfessorSlide } from '@/hooks/lectureSlides';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { VisualDirectiveEditor } from './VisualDirectiveEditor';

interface SlideEditCardProps {
  slide: ProfessorSlide;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onChange: (updated: ProfessorSlide) => void;
  disabled: boolean;
}

const SLIDE_TYPE_COLORS: Record<string, string> = {
  title: 'bg-primary/10 text-primary',
  hook: 'bg-accent/50 text-accent-foreground',
  recap: 'bg-muted text-muted-foreground',
  definition: 'bg-primary/20 text-primary',
  explanation: 'bg-secondary text-secondary-foreground',
  example: 'bg-accent/30 text-accent-foreground',
  demonstration: 'bg-accent/40 text-accent-foreground',
  misconception: 'bg-destructive/10 text-destructive',
  practice: 'bg-primary/15 text-primary',
  synthesis: 'bg-secondary/80 text-secondary-foreground',
  preview: 'bg-muted text-muted-foreground',
  process: 'bg-primary/10 text-primary',
  summary: 'bg-muted text-muted-foreground',
};

export const SlideEditCard = memo(function SlideEditCard({
  slide,
  index,
  isExpanded,
  onToggleExpand,
  onChange,
  disabled,
}: SlideEditCardProps) {
  const updateField = <K extends keyof ProfessorSlide>(key: K, value: ProfessorSlide[K]) => {
    onChange({ ...slide, [key]: value });
  };

  const updateContent = (field: string, value: unknown) => {
    onChange({
      ...slide,
      content: { ...slide.content, [field]: value },
    });
  };

  const typeColor = SLIDE_TYPE_COLORS[slide.type] ?? 'bg-muted text-muted-foreground';

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
            type="button"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="text-sm font-mono text-muted-foreground w-6">{index + 1}</span>
            <Badge variant="outline" className={typeColor}>
              {slide.type}
            </Badge>
            <span className="font-medium truncate">{slide.title}</span>
            {slide.visual?.url && (
              <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                Has image
              </Badge>
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Slide Title</Label>
              <Input
                value={slide.title}
                onChange={(e) => updateField('title', e.target.value)}
                disabled={disabled}
              />
            </div>

            {/* Main Text */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Main Text</Label>
              <Textarea
                value={slide.content?.main_text ?? ''}
                onChange={(e) => updateContent('main_text', e.target.value)}
                disabled={disabled}
                rows={3}
              />
            </div>

            {/* Key Points */}
            {slide.content?.key_points && slide.content.key_points.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Key Points</Label>
                <div className="space-y-2">
                  {slide.content.key_points.map((point, i) => {
                    const pointText = typeof point === 'string' ? point : point?.text ?? '';
                    return (
                      <Input
                        key={i}
                        value={pointText}
                        onChange={(e) => {
                          const newPoints = [...(slide.content.key_points ?? [])];
                          newPoints[i] = e.target.value;
                          updateContent('key_points', newPoints);
                        }}
                        disabled={disabled}
                        placeholder={`Key point ${i + 1}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Definition (conditional) */}
            {slide.type === 'definition' && slide.content?.definition && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Definition</Label>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Term</Label>
                    <Input
                      value={slide.content.definition.term}
                      onChange={(e) =>
                        updateContent('definition', { ...slide.content.definition, term: e.target.value })
                      }
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Formal Definition</Label>
                    <Textarea
                      value={slide.content.definition.formal_definition}
                      onChange={(e) =>
                        updateContent('definition', { ...slide.content.definition, formal_definition: e.target.value })
                      }
                      disabled={disabled}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Simple Explanation</Label>
                    <Textarea
                      value={slide.content.definition.simple_explanation}
                      onChange={(e) =>
                        updateContent('definition', { ...slide.content.definition, simple_explanation: e.target.value })
                      }
                      disabled={disabled}
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Example (conditional) */}
            {slide.type === 'example' && slide.content?.example && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Example</Label>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Scenario</Label>
                    <Textarea
                      value={slide.content.example.scenario}
                      onChange={(e) =>
                        updateContent('example', { ...slide.content.example, scenario: e.target.value })
                      }
                      disabled={disabled}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Walkthrough</Label>
                    <Textarea
                      value={slide.content.example.walkthrough}
                      onChange={(e) =>
                        updateContent('example', { ...slide.content.example, walkthrough: e.target.value })
                      }
                      disabled={disabled}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Connection to Concept</Label>
                    <Textarea
                      value={slide.content.example.connection_to_concept}
                      onChange={(e) =>
                        updateContent('example', { ...slide.content.example, connection_to_concept: e.target.value })
                      }
                      disabled={disabled}
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Misconception (conditional) */}
            {slide.type === 'misconception' && slide.content?.misconception && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Misconception</Label>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Wrong Belief</Label>
                    <Textarea
                      value={slide.content.misconception.wrong_belief}
                      onChange={(e) =>
                        updateContent('misconception', { ...slide.content.misconception, wrong_belief: e.target.value })
                      }
                      disabled={disabled}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Why It's Wrong</Label>
                    <Textarea
                      value={slide.content.misconception.why_wrong}
                      onChange={(e) =>
                        updateContent('misconception', { ...slide.content.misconception, why_wrong: e.target.value })
                      }
                      disabled={disabled}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Correct Understanding</Label>
                    <Textarea
                      value={slide.content.misconception.correct_understanding}
                      onChange={(e) =>
                        updateContent('misconception', { ...slide.content.misconception, correct_understanding: e.target.value })
                      }
                      disabled={disabled}
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Process Steps (conditional) */}
            {slide.type === 'process' && slide.content?.steps && slide.content.steps.length > 0 && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Process Steps</Label>
                <div className="space-y-3">
                  {slide.content.steps.map((step, i) => (
                    <div key={i} className="space-y-1.5 pl-3 border-l-2 border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">Step {step.step}</span>
                        <Input
                          value={step.title}
                          onChange={(e) => {
                            const newSteps = [...(slide.content.steps ?? [])];
                            newSteps[i] = { ...step, title: e.target.value };
                            updateContent('steps', newSteps);
                          }}
                          disabled={disabled}
                          className="h-8 text-sm"
                          placeholder="Step title"
                        />
                      </div>
                      <Textarea
                        value={step.explanation}
                        onChange={(e) => {
                          const newSteps = [...(slide.content.steps ?? [])];
                          newSteps[i] = { ...step, explanation: e.target.value };
                          updateContent('steps', newSteps);
                        }}
                        disabled={disabled}
                        rows={2}
                        placeholder="Step explanation"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Speaker Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Speaker Notes</Label>
              <Textarea
                value={slide.speaker_notes ?? ''}
                onChange={(e) => updateField('speaker_notes', e.target.value)}
                disabled={disabled}
                rows={3}
                className="text-sm"
              />
            </div>

            {/* Visual Directive */}
            <VisualDirectiveEditor
              visualDirective={slide.visual_directive}
              visualPreview={slide.visual}
              onChange={(vd) => updateField('visual_directive', vd)}
              disabled={disabled}
            />

            {/* Pedagogy (read-only) */}
            {slide.pedagogy && (
              <div className="rounded-md bg-muted/30 p-3 space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pedagogy (AI Metadata)</Label>
                <p className="text-xs text-muted-foreground"><strong>Purpose:</strong> {slide.pedagogy.purpose}</p>
                <p className="text-xs text-muted-foreground"><strong>Bloom:</strong> {slide.pedagogy.bloom_action}</p>
                <p className="text-xs text-muted-foreground"><strong>Transition:</strong> {slide.pedagogy.transition_to_next}</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});
