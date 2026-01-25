import { PageContainer, PageHeader } from "@/components/layout";
import { IdentityVerificationFlow } from "@/components/student/IdentityVerificationFlow";

export default function IdentityVerificationPage() {
  return (
    <PageContainer>
      <PageHeader 
        title="Identity Verification"
        description="Verify your identity to unlock assessed certificates"
      />
      <div className="max-w-2xl mx-auto">
        <IdentityVerificationFlow />
      </div>
    </PageContainer>
  );
}
