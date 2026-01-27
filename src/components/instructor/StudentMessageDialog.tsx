import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Users, AlertCircle } from 'lucide-react';
import { useSendReminder } from '@/hooks/useGradebook';
import { useToast } from '@/hooks/use-toast';

interface StudentMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  studentIds: string[];
}

const MESSAGE_TEMPLATES = [
  {
    id: 'custom',
    label: 'Custom Message',
    message: '',
  },
  {
    id: 'reminder',
    label: 'Course Reminder',
    message: `Hi there! Just a friendly reminder to continue with your course progress. You're doing great so far - keep up the momentum!`,
  },
  {
    id: 'deadline',
    label: 'Upcoming Deadline',
    message: `Heads up! There's an upcoming deadline for your course assignments. Please make sure to complete your work on time.`,
  },
  {
    id: 'support',
    label: 'Offer Support',
    message: `I noticed you might be having some difficulty with the course material. I'm here to help! Feel free to reach out if you have any questions.`,
  },
  {
    id: 'congratulations',
    label: 'Congratulations',
    message: `Congratulations on your excellent progress! You're doing an amazing job with the course. Keep up the great work!`,
  },
  {
    id: 'feedback',
    label: 'Request Feedback',
    message: `I'd love to hear your feedback on the course so far. Please let me know if there's anything I can do to improve your learning experience.`,
  },
];

export function StudentMessageDialog({
  open,
  onOpenChange,
  courseId,
  studentIds,
}: StudentMessageDialogProps) {
  const { toast } = useToast();
  const sendReminderMutation = useSendReminder(courseId);

  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  const [message, setMessage] = useState('');

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = MESSAGE_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setMessage(template.message);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast({
        title: 'Message Required',
        description: 'Please enter a message to send.',
        variant: 'destructive',
      });
      return;
    }

    const result = await sendReminderMutation.mutateAsync({
      studentIds,
      message: message.trim(),
    });

    if (result.success) {
      toast({
        title: 'Message Sent',
        description: `Your message has been sent to ${studentIds.length} student${studentIds.length > 1 ? 's' : ''}.`,
      });
      setMessage('');
      setSelectedTemplate('custom');
      onOpenChange(false);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to send message',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    setMessage('');
    setSelectedTemplate('custom');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Message to Students
          </DialogTitle>
          <DialogDescription>
            Send a message to the selected students. They'll receive it as a notification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipients */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Recipients:</span>
            <Badge variant="secondary">
              {studentIds.length} student{studentIds.length > 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label htmlFor="template">Message Template</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {MESSAGE_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {message.length} / 500 characters
            </p>
          </div>

          {/* Warning for bulk messages */}
          {studentIds.length > 10 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-md text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                You're sending a message to many students. Make sure your message is appropriate for all recipients.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendReminderMutation.isPending}
          >
            {sendReminderMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
