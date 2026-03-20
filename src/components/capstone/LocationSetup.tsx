import { useState } from 'react';
import { MapPin, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateInstructorCourse } from '@/hooks/useInstructorCourses';

interface LocationSetupProps {
  courseId: string;
  initialValues?: {
    location_city?: string | null;
    location_state?: string | null;
    location_zip?: string | null;
    search_location?: string | null;
    academic_level?: string | null;
  };
  onSaved?: () => void;
}

export function LocationSetup({ courseId, initialValues, onSaved }: LocationSetupProps) {
  const [city, setCity] = useState(initialValues?.location_city || '');
  const [state, setState] = useState(initialValues?.location_state || '');
  const [zip, setZip] = useState(initialValues?.location_zip || '');
  const [level, setLevel] = useState(initialValues?.academic_level || '');
  const updateCourse = useUpdateInstructorCourse();

  const handleSave = () => {
    const searchLocation = [city, state, zip].filter(Boolean).join(', ');
    updateCourse.mutate(
      {
        courseId,
        updates: {
          location_city: city || null,
          location_state: state || null,
          location_zip: zip || null,
          search_location: searchLocation || null,
          academic_level: level || null,
        },
      },
      { onSuccess: () => onSaved?.() }
    );
  };

  return (
    <Card className="border-dashed border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Set Course Location
        </CardTitle>
        <CardDescription className="text-sm">
          Location helps discover nearby industry partners for capstone projects.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="city" className="text-xs">City</Label>
            <Input id="city" placeholder="e.g. Austin" value={city} onChange={e => setCity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state" className="text-xs">State</Label>
            <Input id="state" placeholder="e.g. TX" value={state} onChange={e => setState(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zip" className="text-xs">Zip Code</Label>
            <Input id="zip" placeholder="e.g. 78701" value={zip} onChange={e => setZip(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="level" className="text-xs">Academic Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger id="level">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="undergraduate">Undergraduate</SelectItem>
                <SelectItem value="graduate">Graduate</SelectItem>
                <SelectItem value="doctoral">Doctoral</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={updateCourse.isPending || (!city && !state && !zip)}
          className="mt-4 gap-2"
          size="sm"
        >
          <Save className="h-3.5 w-3.5" />
          {updateCourse.isPending ? 'Saving...' : 'Save Location'}
        </Button>
      </CardContent>
    </Card>
  );
}
