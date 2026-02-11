import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Volume2 } from 'lucide-react';

const VOICES = [
  { id: 'onyx', label: 'Professor Onyx', description: 'Deep, authoritative' },
  { id: 'nova', label: 'Dr. Nova', description: 'Warm, friendly' },
  { id: 'echo', label: 'Dr. Echo', description: 'Clear, measured' },
  { id: 'alloy', label: 'Prof. Alloy', description: 'Balanced, neutral' },
  { id: 'fable', label: 'Dr. Fable', description: 'Expressive, storytelling' },
  { id: 'shimmer', label: 'Prof. Shimmer', description: 'Calm, reassuring' },
] as const;

interface VoicePickerProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function VoicePicker({ value, onValueChange }: VoicePickerProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[160px] h-8 text-xs">
        <Volume2 className="h-3 w-3 mr-1 shrink-0" />
        <SelectValue placeholder="Voice" />
      </SelectTrigger>
      <SelectContent>
        {VOICES.map((voice) => (
          <SelectItem key={voice.id} value={voice.id}>
            <div className="flex flex-col">
              <span className="text-xs font-medium">{voice.label}</span>
              <span className="text-[10px] text-muted-foreground">{voice.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
