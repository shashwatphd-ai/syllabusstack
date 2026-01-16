import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Filter, X, DollarSign, GraduationCap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CareerFiltersState {
  minMatchScore: number;
  minSalary: number | null;
  educationLevel: string | null;
  jobOutlook: string | null;
}

interface CareerFiltersProps {
  filters: CareerFiltersState;
  onFiltersChange: (filters: CareerFiltersState) => void;
  className?: string;
}

const EDUCATION_LEVELS = [
  { value: 'high_school', label: 'High School Diploma' },
  { value: 'some_college', label: 'Some College' },
  { value: 'associates', label: "Associate's Degree" },
  { value: 'bachelors', label: "Bachelor's Degree" },
  { value: 'masters', label: "Master's Degree" },
  { value: 'doctoral', label: 'Doctoral Degree' },
];

const JOB_OUTLOOK_OPTIONS = [
  { value: 'bright', label: 'Bright Outlook', icon: '🌟' },
  { value: 'average', label: 'Average Growth', icon: '📈' },
  { value: 'declining', label: 'Declining', icon: '📉' },
];

const DEFAULT_FILTERS: CareerFiltersState = {
  minMatchScore: 0,
  minSalary: null,
  educationLevel: null,
  jobOutlook: null,
};

export function CareerFilters({ filters, onFiltersChange, className }: CareerFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFilterCount = [
    filters.minMatchScore > 0,
    filters.minSalary !== null,
    filters.educationLevel !== null,
    filters.jobOutlook !== null,
  ].filter(Boolean).length;

  const handleReset = () => {
    onFiltersChange(DEFAULT_FILTERS);
  };

  const updateFilter = <K extends keyof CareerFiltersState>(
    key: K,
    value: CareerFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filter Careers</h4>
              {activeFilterCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleReset}
                  className="h-8 px-2 text-xs"
                >
                  Reset All
                </Button>
              )}
            </div>

            {/* Match Score Filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Minimum Match Score</Label>
                <span className="text-sm text-muted-foreground">
                  {filters.minMatchScore}%+
                </span>
              </div>
              <Slider
                value={[filters.minMatchScore]}
                onValueChange={([value]) => updateFilter('minMatchScore', value)}
                min={0}
                max={90}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>All</span>
                <span>90%+</span>
              </div>
            </div>

            {/* Salary Filter */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Minimum Salary
              </Label>
              <Select
                value={filters.minSalary?.toString() || 'any'}
                onValueChange={(value) => 
                  updateFilter('minSalary', value === 'any' ? null : parseInt(value))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any salary" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any salary</SelectItem>
                  <SelectItem value="40000">$40,000+</SelectItem>
                  <SelectItem value="60000">$60,000+</SelectItem>
                  <SelectItem value="80000">$80,000+</SelectItem>
                  <SelectItem value="100000">$100,000+</SelectItem>
                  <SelectItem value="150000">$150,000+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Education Level Filter */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Education Level
              </Label>
              <Select
                value={filters.educationLevel || 'any'}
                onValueChange={(value) => 
                  updateFilter('educationLevel', value === 'any' ? null : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any level</SelectItem>
                  {EDUCATION_LEVELS.map(level => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Job Outlook Filter */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Job Outlook
              </Label>
              <Select
                value={filters.jobOutlook || 'any'}
                onValueChange={(value) => 
                  updateFilter('jobOutlook', value === 'any' ? null : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any outlook" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any outlook</SelectItem>
                  {JOB_OUTLOOK_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.icon} {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filter Pills */}
      {activeFilterCount > 0 && (
        <div className="flex gap-1 flex-wrap">
          {filters.minMatchScore > 0 && (
            <Badge variant="secondary" className="gap-1">
              {filters.minMatchScore}%+ Match
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('minMatchScore', 0)}
              />
            </Badge>
          )}
          {filters.minSalary && (
            <Badge variant="secondary" className="gap-1">
              ${(filters.minSalary / 1000).toFixed(0)}k+
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('minSalary', null)}
              />
            </Badge>
          )}
          {filters.educationLevel && (
            <Badge variant="secondary" className="gap-1">
              {EDUCATION_LEVELS.find(l => l.value === filters.educationLevel)?.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('educationLevel', null)}
              />
            </Badge>
          )}
          {filters.jobOutlook && (
            <Badge variant="secondary" className="gap-1">
              {JOB_OUTLOOK_OPTIONS.find(o => o.value === filters.jobOutlook)?.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('jobOutlook', null)}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export const DEFAULT_CAREER_FILTERS = DEFAULT_FILTERS;
