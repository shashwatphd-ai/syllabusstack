import { CourseLeaderboard } from './CourseLeaderboard';
import { ChallengeCard } from './ChallengeCard';

interface CommunityTabProps {
  courseId: string;
  learningObjectives: Array<{ id: string; text: string }>;
}

export function CommunityTab({ courseId, learningObjectives }: CommunityTabProps) {
  return (
    <div className="space-y-4">
      <CourseLeaderboard courseId={courseId} />
      <ChallengeCard courseId={courseId} learningObjectives={learningObjectives} />
    </div>
  );
}
