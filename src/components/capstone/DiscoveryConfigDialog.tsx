import { useState } from 'react';
import { Settings2, Search, Loader2 } from 'lucide-react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from '@/components/common/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export interface DiscoveryConfig {
  targetIndustries: string[];
  maxCompanies: number;
  maxDistanceMiles: number;
  minEmployees: string;
}

interface DiscoveryConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (config: DiscoveryConfig) => void;
  isPending: boolean;
  courseName?: string;
}

const INDUSTRY_SUGGESTIONS = [
  'Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Consulting',
  'Energy', 'Retail', 'Education', 'Media', 'Logistics',
  'Telecommunications', 'Aerospace', 'Pharmaceuticals', 'Real Estate',
];

export function DiscoveryConfigDialog({ open, onOpenChange, onStart, isPending, courseName }: DiscoveryConfigDialogProps) {
  const [industryInput, setIndustryInput] = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [maxCompanies, setMaxCompanies] = useState(15);
  const [maxDistance, setMaxDistance] = useState(50);
  const [minEmployees, setMinEmployees] = useState('10');

  const addIndustry = (industry: string) => {
    const trimmed = industry.trim();
    if (trimmed && !selectedIndustries.includes(trimmed)) {
      setSelectedIndustries(prev => [...prev, trimmed]);
    }
    setIndustryInput('');
  };

  const removeIndustry = (industry: string) => {
    setSelectedIndustries(prev => prev.filter(i => i !== industry));
  };

  const handleStart = () => {
    onStart({
      targetIndustries: selectedIndustries,
      maxCompanies,
      maxDistanceMiles: maxDistance,
      minEmployees,
    });
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Configure Discovery
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Set parameters for discovering industry partners{courseName ? ` for ${courseName}` : ''}.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-5 py-2">
          {/* Target Industries */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Target Industries</Label>
            <p className="text-xs text-muted-foreground">Leave empty for AI-recommended industries based on your course.</p>
            <div className="flex gap-2">
              <Input
                value={industryInput}
                onChange={(e) => setIndustryInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIndustry(industryInput))}
                placeholder="Type and press Enter..."
                className="h-8 text-sm"
              />
            </div>
            {selectedIndustries.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedIndustries.map(ind => (
                  <Badge key={ind} variant="secondary" className="text-xs cursor-pointer gap-1" onClick={() => removeIndustry(ind)}>
                    {ind} ×
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {INDUSTRY_SUGGESTIONS.filter(s => !selectedIndustries.includes(s)).slice(0, 8).map(s => (
                <Badge key={s} variant="outline" className="text-[10px] cursor-pointer hover:bg-accent" onClick={() => addIndustry(s)}>
                  + {s}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Max Companies */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Target Companies</Label>
              <span className="text-sm font-medium text-primary">{maxCompanies}</span>
            </div>
            <Slider
              value={[maxCompanies]}
              onValueChange={([v]) => setMaxCompanies(v)}
              min={5}
              max={30}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Number of companies to discover and evaluate.</p>
          </div>

          <Separator />

          {/* Max Distance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Max Distance</Label>
              <span className="text-sm font-medium text-primary">{maxDistance} miles</span>
            </div>
            <Slider
              value={[maxDistance]}
              onValueChange={([v]) => setMaxDistance(v)}
              min={10}
              max={200}
              step={10}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Maximum distance from your institution.</p>
          </div>

          <Separator />

          {/* Min Employees */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Minimum Company Size</Label>
            <Input
              value={minEmployees}
              onChange={(e) => setMinEmployees(e.target.value)}
              placeholder="e.g. 10"
              className="h-8 text-sm w-32"
              type="number"
            />
            <p className="text-xs text-muted-foreground">Minimum number of employees.</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleStart} disabled={isPending} className="gap-2">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {isPending ? 'Discovering...' : 'Start Discovery'}
            </Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
