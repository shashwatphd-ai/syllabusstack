import { useState } from 'react';
import { Send, Building2, Calendar, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProjectProposalFormProps {
  onSuccess?: () => void;
}

/**
 * Employer project proposal form.
 * Extends the basic employer_interest_submissions with structured project data.
 * Used by employers who want to propose capstone projects for specific courses.
 */
export default function ProjectProposalForm({ onSuccess }: ProjectProposalFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    project_description: '',
    preferred_timeline: 'spring_2027',
    department_preference: '',
  });
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills(p => [...p, s]);
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setSkills(p => p.filter(s => s !== skill));
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('employer_interest_submissions')
        .insert({
          company_name: form.company_name,
          contact_name: form.contact_name,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone || null,
          project_description: form.project_description,
          target_skills: skills.length > 0 ? skills : null,
          preferred_timeline: form.preferred_timeline,
          status: 'pending',
          submitted_by: user?.id || null,
          notes: form.department_preference
            ? JSON.stringify({ department_preference: form.department_preference })
            : null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Proposal Submitted',
        description: 'Your project proposal has been sent to the academic team for review.',
      });
      queryClient.invalidateQueries({ queryKey: ['employer-interest'] });
      setForm({
        company_name: '', contact_name: '', contact_email: '',
        contact_phone: '', project_description: '', preferred_timeline: 'spring_2027',
        department_preference: '',
      });
      setSkills([]);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: 'Submission Failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const isValid = form.company_name && form.contact_name && form.contact_email && form.project_description;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Propose a Capstone Project
        </CardTitle>
        <CardDescription>
          Submit a project idea for students. Our faculty will match it with the right course and team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); submitMutation.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                placeholder="Acme Corp"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department / Course Preference</Label>
              <Input
                id="department"
                value={form.department_preference}
                onChange={e => setForm(f => ({ ...f, department_preference: e.target.value }))}
                placeholder="e.g., Computer Science, Business"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name *</Label>
              <Input
                id="contact_name"
                value={form.contact_name}
                onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email *</Label>
              <Input
                id="contact_email"
                type="email"
                value={form.contact_email}
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Phone</Label>
              <Input
                id="contact_phone"
                value={form.contact_phone}
                onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Project Description *</Label>
            <Textarea
              id="description"
              value={form.project_description}
              onChange={e => setForm(f => ({ ...f, project_description: e.target.value }))}
              placeholder="Describe the project scope, deliverables, and what students would learn..."
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Required Skills</Label>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                placeholder="Add a skill and press Enter"
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={addSkill}>Add</Button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {skills.map(s => (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeSkill(s)}
                  >
                    {s} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Preferred Timeline</Label>
            <Select
              value={form.preferred_timeline}
              onValueChange={v => setForm(f => ({ ...f, preferred_timeline: v }))}
            >
              <SelectTrigger>
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spring_2027">Spring 2027</SelectItem>
                <SelectItem value="fall_2026">Fall 2026</SelectItem>
                <SelectItem value="summer_2026">Summer 2026</SelectItem>
                <SelectItem value="flexible">Flexible</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={!isValid || submitMutation.isPending}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {submitMutation.isPending ? 'Submitting...' : 'Submit Project Proposal'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
