import { useEffect } from 'react';

interface CompanyProfileForAnalytics {
  name: string;
  data_enrichment_level?: string | null;
  data_completeness_score?: number | null;
}

export const useProjectAnalytics = (
  projectId: string,
  projectTitle: string,
  companyProfile?: CompanyProfileForAnalytics | null
) => {
  useEffect(() => {
    if (!projectId || !companyProfile) return;

    console.log('📊 Project Analytics:', {
      project: projectTitle,
      company: companyProfile.name,
      dataQuality: `${companyProfile.data_enrichment_level || 'basic'} (${companyProfile.data_completeness_score || 0}%)`,
    });
  }, [projectId, projectTitle, companyProfile]);

  return {
    trackEvent: (eventName: string, data?: Record<string, unknown>) => {
      console.log(`🎯 Event: ${eventName}`, data);
    }
  };
};
