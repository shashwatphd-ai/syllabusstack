import { PageContainer, PageHeader } from "@/components/layout";
import { InstructorVerificationFlow } from "@/components/instructor/InstructorVerificationFlow";

export default function InstructorVerificationPage() {
  return (
    <PageContainer>
      <PageHeader 
        title="Instructor Verification"
        description="Verify your instructor account to build trust and issue certificates"
      />
      <div className="max-w-2xl mx-auto">
        <InstructorVerificationFlow />
      </div>
    </PageContainer>
  );
}
