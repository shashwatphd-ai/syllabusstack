import { useParams, useNavigate } from 'react-router-dom';
import { useLectureSlide } from '@/hooks/useLectureSlides';
import { LoadingState } from '@/components/common/LoadingState';
import { StudentSlideViewer } from '@/components/slides/StudentSlideViewer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function StudentSlidePage() {
  const { slideId } = useParams<{ slideId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: lectureSlide, isLoading, error } = useLectureSlide(slideId);

  const handleClose = () => {
    navigate(-1);
  };

  const handleComplete = async (watchPercentage: number) => {
    if (!user || !lectureSlide) return;

    try {
      // Track slide completion - similar to video consumption tracking
      // This could be expanded to store in a consumption_records-like table
      console.log('Slide completion tracked:', {
        slideId: lectureSlide.id,
        watchPercentage,
        userId: user.id
      });

      if (watchPercentage >= 80) {
        toast({
          title: "Great progress!",
          description: "You've completed this lecture. Keep learning!",
        });
      }
    } catch (error) {
      console.error('Error tracking slide completion:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState message="Loading lecture slides..." />
      </div>
    );
  }

  if (error || !lectureSlide) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Lecture not found</h2>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : 'The lecture slides you\'re looking for don\'t exist or aren\'t published yet.'}
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <StudentSlideViewer
      lectureSlide={lectureSlide}
      unitTitle={lectureSlide.title}
      onClose={handleClose}
      onComplete={handleComplete}
    />
  );
}
