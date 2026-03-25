import { useState } from 'react';
import { Mail, Linkedin, Save, Send, Copy, Check } from 'lucide-react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from '@/components/common/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useCreatePartnershipProposal } from '@/hooks/usePartnershipProposals';
import { useAuth } from '@/contexts/AuthContext';
import type { CompanyProfile } from '@/hooks/useCapstoneProjects';

interface ProposePartnershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  courseId: string;
  projectTitle: string;
  company: CompanyProfile | null;
  contactName?: string;
  contactEmail?: string;
  contactTitle?: string;
}

type Channel = 'email' | 'linkedin' | 'saved';

const CHANNELS: { value: Channel; label: string; icon: typeof Mail; description: string }[] = [
  { value: 'email', label: 'Email', icon: Mail, description: 'Opens your mail client with the message' },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, description: 'Copy message for LinkedIn outreach' },
  { value: 'saved', label: 'Save for Later', icon: Save, description: 'Save as draft to send later' },
];

function generateDefaultMessage(
  projectTitle: string,
  companyName: string,
  contactName: string,
  senderName?: string,
): string {
  const greeting = contactName ? `Dear ${contactName}` : 'Dear Hiring Manager';
  const signoff = senderName || '[Your Name]';
  return `${greeting},

I am reaching out regarding a potential capstone project partnership with ${companyName}.

We have identified "${projectTitle}" as a strong match between our students' learning objectives and your company's current needs. This partnership would provide your team with deliverables from motivated students while giving them real-world industry experience.

Key benefits for ${companyName}:
- Access to student talent aligned with your technology stack
- Deliverables scoped to your business needs at no cost
- Early pipeline to potential future hires

I would love to schedule a brief call to discuss how we can structure this partnership to maximize value for both sides.

Best regards,
${signoff}`;
}

export function ProposePartnershipDialog({
  open,
  onOpenChange,
  projectId,
  courseId,
  projectTitle,
  company,
  contactName,
  contactEmail,
  contactTitle,
}: ProposePartnershipDialogProps) {
  const { profile } = useAuth();
  const senderName = profile?.full_name || undefined;

  const [channel, setChannel] = useState<Channel>('email');
  const [subject, setSubject] = useState(
    `Capstone Partnership Proposal: ${projectTitle}`
  );
  const [message, setMessage] = useState(
    generateDefaultMessage(projectTitle, company?.name || 'your company', contactName || '', senderName)
  );
  const [recipientEmail, setRecipientEmail] = useState(contactEmail || '');
  const [copied, setCopied] = useState(false);

  const createProposal = useCreatePartnershipProposal();

  const handleSend = () => {
    createProposal.mutate(
      {
        instructorCourseId: courseId,
        capstoneProjectId: projectId,
        companyProfileId: company?.id,
        channel,
        subject,
        messageBody: message,
        recipientEmail: recipientEmail || undefined,
        recipientName: contactName,
        recipientTitle: contactTitle,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-lg">Propose Partnership</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Reach out to {company?.name || 'company'} about "{projectTitle}"
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 mt-2">
          {/* Channel Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Outreach Channel</label>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.value}
                  onClick={() => setChannel(ch.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-colors ${
                    channel === ch.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <ch.icon className="h-4 w-4" />
                  <span className="font-medium">{ch.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {CHANNELS.find((c) => c.value === channel)?.description}
            </p>
          </div>

          <Separator />

          {/* Recipient (for email) */}
          {channel === 'email' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Recipient Email</label>
              <Input
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="contact@company.com"
                type="email"
              />
              {contactName && (
                <p className="text-xs text-muted-foreground">
                  To: {contactName}
                  {contactTitle && ` (${contactTitle})`}
                </p>
              )}
            </div>
          )}

          {/* Subject */}
          {channel !== 'linkedin' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Partnership proposal subject"
              />
            </div>
          )}

          {/* Message Body */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Message</label>
              {channel === 'linkedin' && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleCopyMessage}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              )}
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="text-sm"
              placeholder="Write your partnership proposal message..."
            />
          </div>

          {/* Company context badge */}
          {company && (
            <div className="flex flex-wrap gap-2">
              {company.composite_signal_score != null && (
                <Badge variant="outline" className="text-[10px]">
                  Signal Score: {Math.round(company.composite_signal_score)}%
                </Badge>
              )}
              {company.employee_count && (
                <Badge variant="outline" className="text-[10px]">
                  {company.employee_count} employees
                </Badge>
              )}
              {company.sector && company.sector !== 'Unknown' && (
                <Badge variant="outline" className="text-[10px]">
                  {company.sector}
                </Badge>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleSend}
              disabled={createProposal.isPending || !message.trim()}
            >
              {channel === 'email' && <Send className="h-4 w-4" />}
              {channel === 'linkedin' && <Linkedin className="h-4 w-4" />}
              {channel === 'saved' && <Save className="h-4 w-4" />}
              {createProposal.isPending
                ? 'Saving...'
                : channel === 'email'
                  ? 'Send Email'
                  : channel === 'linkedin'
                    ? 'Save & Copy'
                    : 'Save Draft'}
            </Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
