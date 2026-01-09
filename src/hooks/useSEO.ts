import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  type?: 'website' | 'article';
  image?: string;
}

const BASE_TITLE = 'SyllabusStack';
const DEFAULT_DESCRIPTION = 'Know your real job readiness. Upload your coursework, add your dream jobs, and get honest AI analysis of exactly where you stand—and what to do next.';

export function useSEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords,
  canonical,
  type = 'website',
  image,
}: SEOProps = {}) {
  useEffect(() => {
    // Update document title
    document.title = title ? `${title} | ${BASE_TITLE}` : `${BASE_TITLE} - AI-Powered Career Intelligence for Students`;

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', description);
    }

    // Update keywords if provided
    if (keywords) {
      let metaKeywords = document.querySelector('meta[name="keywords"]');
      if (metaKeywords) {
        metaKeywords.setAttribute('content', keywords);
      }
    }

    // Update Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const ogType = document.querySelector('meta[property="og:type"]');

    if (ogTitle) ogTitle.setAttribute('content', title || BASE_TITLE);
    if (ogDescription) ogDescription.setAttribute('content', description);
    if (ogType) ogType.setAttribute('content', type);

    // Update Twitter tags
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');

    if (twitterTitle) twitterTitle.setAttribute('content', title || BASE_TITLE);
    if (twitterDescription) twitterDescription.setAttribute('content', description);

    // Update canonical if provided
    if (canonical) {
      let canonicalLink = document.querySelector('link[rel="canonical"]');
      if (canonicalLink) {
        canonicalLink.setAttribute('href', canonical);
      }
    }

    // Cleanup function to reset to defaults
    return () => {
      document.title = `${BASE_TITLE} - AI-Powered Career Intelligence for Students`;
    };
  }, [title, description, keywords, canonical, type, image]);
}

// Page-specific SEO configurations
export const pageSEO = {
  dashboard: {
    title: 'Dashboard',
    description: 'View your career progress dashboard. Track courses, capabilities, and job readiness.',
  },
  courses: {
    title: 'My Courses',
    description: 'Manage your courses and syllabi. Track the skills and capabilities you\'re developing.',
  },
  dreamJobs: {
    title: 'Dream Jobs',
    description: 'Track your target roles and understand what skills you need to land your dream job.',
  },
  analysis: {
    title: 'Gap Analysis',
    description: 'Get honest AI analysis of your job readiness. Understand exactly where you stand.',
  },
  recommendations: {
    title: 'Recommendations',
    description: 'Personalized recommendations to close skill gaps and boost your career readiness.',
  },
  profile: {
    title: 'Profile',
    description: 'Manage your SyllabusStack profile and academic information.',
  },
  settings: {
    title: 'Settings',
    description: 'Configure your SyllabusStack preferences and account settings.',
  },
  usage: {
    title: 'AI Usage',
    description: 'Track your AI analysis usage and costs.',
  },
  onboarding: {
    title: 'Get Started',
    description: 'Set up your SyllabusStack account and start your career intelligence journey.',
  },
  syllabusScanner: {
    title: 'Free Syllabus Scanner',
    description: 'Instantly analyze any course syllabus for free. Discover the skills and capabilities hidden in your coursework.',
    keywords: 'syllabus analyzer, course analysis, skill extraction, free career tool, student tools',
  },
};
