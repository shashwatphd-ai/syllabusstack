import { useState } from 'react';
import { Copy, Check, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

interface ShareCourseTemplateProps {
  title: string;
  accessCode: string;
  appUrl?: string;
}

export function ShareCourseTemplate({ title, accessCode, appUrl = 'https://www.syllabusstack.com' }: ShareCourseTemplateProps) {
  const [copied, setCopied] = useState(false);

  const template = `Join my course "${title}" on SyllabusStack!

1. Go to: ${appUrl}/learn
2. Click "Join Course"
3. Enter access code: ${accessCode}

See you in class!`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(template);
    setCopied(true);
    toast({ title: 'Copied!', description: 'Share template copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <Textarea
        readOnly
        value={template}
        className="font-mono text-sm resize-none bg-muted/50 min-h-[140px]"
        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy to Clipboard'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            window.open(`mailto:?subject=${encodeURIComponent(`Join: ${title}`)}&body=${encodeURIComponent(template)}`);
          }}
        >
          <Mail className="h-4 w-4" />
          Email
        </Button>
      </div>
    </div>
  );
}
