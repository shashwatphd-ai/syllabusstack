import { useState } from 'react';
import { LikertScale } from './LikertScale';
import { ProficiencySlider } from './ProficiencySlider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Question {
  id: string;
  question_text: string;
  question_type: 'likert_5' | 'likert_7' | 'slider_100' | 'forced_choice';
  framework: 'holland_riasec' | 'onet_skills' | 'work_values';
  measures_dimension: string;
  response_options?: Record<string, unknown> | null;
}

interface QuestionRendererProps {
  question: Question;
  onAnswer: (value: number) => void;
  isSubmitting?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
}

const FRAMEWORK_COLORS: Record<string, string> = {
  holland_riasec: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  onet_skills: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  work_values: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const FRAMEWORK_LABELS: Record<string, string> = {
  holland_riasec: 'Interests',
  onet_skills: 'Skills',
  work_values: 'Values',
};

export function QuestionRenderer({
  question,
  onAnswer,
  isSubmitting = false,
  questionNumber,
  totalQuestions,
}: QuestionRendererProps) {
  const [selectedValue, setSelectedValue] = useState<number | null>(null);

  const handleSelect = (value: number) => {
    setSelectedValue(value);
    // Auto-submit after a brief delay for better UX
    setTimeout(() => {
      onAnswer(value);
      setSelectedValue(null);
    }, 300);
  };

  const renderInput = () => {
    switch (question.question_type) {
      case 'likert_5':
        return (
          <LikertScale
            value={selectedValue}
            onChange={handleSelect}
            points={5}
            disabled={isSubmitting}
          />
        );

      case 'likert_7':
        return (
          <LikertScale
            value={selectedValue}
            onChange={handleSelect}
            points={7}
            disabled={isSubmitting}
          />
        );

      case 'slider_100':
        return (
          <div className="space-y-4">
            <ProficiencySlider
              value={selectedValue ?? 50}
              onChange={setSelectedValue}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => selectedValue !== null && handleSelect(selectedValue)}
              disabled={isSubmitting || selectedValue === null}
              className={cn(
                'w-full py-3 rounded-lg font-medium transition-all',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isSubmitting ? 'Saving...' : 'Confirm Rating'}
            </button>
          </div>
        );

      case 'forced_choice':
        const options = (question.response_options as { options?: string[] })?.options || [];
        return (
          <div className="grid gap-3">
            {options.map((option, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelect(index + 1)}
                disabled={isSubmitting}
                className={cn(
                  'w-full p-4 rounded-lg border-2 text-left transition-all',
                  'hover:border-primary hover:bg-primary/5',
                  'focus:outline-none focus:ring-2 focus:ring-primary',
                  selectedValue === index + 1
                    ? 'border-primary bg-primary/10'
                    : 'border-border',
                  isSubmitting && 'opacity-50 cursor-not-allowed'
                )}
              >
                {option}
              </button>
            ))}
          </div>
        );

      default:
        return (
          <LikertScale
            value={selectedValue}
            onChange={handleSelect}
            points={5}
            disabled={isSubmitting}
          />
        );
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <Badge className={cn('text-xs', FRAMEWORK_COLORS[question.framework])}>
            {FRAMEWORK_LABELS[question.framework]}
          </Badge>
          {questionNumber && totalQuestions && (
            <span className="text-sm text-muted-foreground">
              {questionNumber} of {totalQuestions}
            </span>
          )}
        </div>
        <CardTitle className="text-xl leading-relaxed">
          {question.question_text}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {renderInput()}
      </CardContent>
    </Card>
  );
}
