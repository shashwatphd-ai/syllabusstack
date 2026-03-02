import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ProfessorSlide } from '@/hooks/lectureSlides';

type VisualDirective = NonNullable<ProfessorSlide['visual_directive']>;

const VISUAL_TYPES = [
  { value: 'diagram', label: 'Diagram' },
  { value: 'screenshot', label: 'Screenshot' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'flowchart', label: 'Flowchart' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'none', label: 'None (skip image)' },
] as const;

interface VisualDirectiveEditorProps {
  visualDirective?: VisualDirective;
  visualPreview?: ProfessorSlide['visual'];
  onChange: (vd: VisualDirective) => void;
  disabled: boolean;
}

export function VisualDirectiveEditor({ visualDirective, visualPreview, onChange, disabled }: VisualDirectiveEditorProps) {
  const vd: VisualDirective = visualDirective ?? {
    type: 'none',
    description: '',
    elements: [],
    style: '',
    educational_purpose: '',
  };

  const update = (field: keyof VisualDirective, value: unknown) => {
    onChange({ ...vd, [field]: value });
  };

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Visual Directive
        </Label>
        {visualPreview?.url && (
          <Badge variant="outline" className="text-xs">Image generated</Badge>
        )}
      </div>

      {/* Image preview thumbnail */}
      {visualPreview?.url && (
        <div className="rounded-md overflow-hidden border border-border bg-muted/30">
          <img
            src={visualPreview.url}
            alt={visualPreview.alt_text ?? 'Slide visual'}
            className="w-full max-h-40 object-contain"
            loading="lazy"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select
            value={vd.type}
            onValueChange={(v) => update('type', v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISUAL_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Style</Label>
          <Input
            value={vd.style ?? ''}
            onChange={(e) => update('style', e.target.value)}
            disabled={disabled}
            className="h-8 text-sm"
            placeholder="e.g. clean academic, minimal"
          />
        </div>
      </div>

      {vd.type !== 'none' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Description (image prompt input)</Label>
            <Textarea
              value={vd.description ?? ''}
              onChange={(e) => update('description', e.target.value)}
              disabled={disabled}
              rows={2}
              placeholder="Describe what the image should show…"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Elements (comma-separated)</Label>
            <Input
              value={(vd.elements ?? []).join(', ')}
              onChange={(e) =>
                update('elements', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
              }
              disabled={disabled}
              className="h-8 text-sm"
              placeholder="e.g. x-axis, y-axis, trend line"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Educational Purpose</Label>
            <Input
              value={vd.educational_purpose ?? ''}
              onChange={(e) => update('educational_purpose', e.target.value)}
              disabled={disabled}
              className="h-8 text-sm"
              placeholder="Why this visual helps learning"
            />
          </div>
        </>
      )}
    </div>
  );
}
