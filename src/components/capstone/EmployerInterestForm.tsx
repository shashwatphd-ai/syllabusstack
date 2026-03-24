import { useState } from 'react';
import { Building2, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useSubmitEmployerInterest } from '@/hooks/useEmployerInterest';

export function EmployerInterestForm() {
  const submit = useSubmitEmployerInterest();
  const [form, setForm] = useState({
    company_name: '', contact_name: '', contact_email: '',
    contact_phone: '', project_description: '', preferred_timeline: '',
  });
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills(p => [...p, s]);
    setSkillInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit.mutate({
      ...form,
      target_skills: skills.length > 0 ? skills : undefined,
    }, {
      onSuccess: () => {
        setForm({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', project_description: '', preferred_timeline: '' });
        setSkills([]);
      },
    });
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          Propose Partnership
        </CardTitle>
        <CardDescription>Submit your interest in hosting a capstone project.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Company Name *</Label>
              <Input required value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contact Name *</Label>
              <Input required value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email *</Label>
              <Input required type="email" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} className="h-8 text-sm" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Project Description</Label>
            <Textarea value={form.project_description} onChange={e => setForm(p => ({ ...p, project_description: e.target.value }))} rows={3} className="text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Target Skills</Label>
            <div className="flex gap-2">
              <Input value={skillInput} onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="Type and press Enter" className="h-8 text-sm" />
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {skills.map(s => (
                  <Badge key={s} variant="secondary" className="text-xs cursor-pointer" onClick={() => setSkills(p => p.filter(x => x !== s))}>
                    {s} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Preferred Timeline</Label>
            <Input value={form.preferred_timeline} onChange={e => setForm(p => ({ ...p, preferred_timeline: e.target.value }))} placeholder="e.g. Spring 2026" className="h-8 text-sm" />
          </div>

          <Button type="submit" disabled={submit.isPending} className="w-full gap-2">
            <Send className="h-4 w-4" />
            {submit.isPending ? 'Submitting...' : 'Submit Interest'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
