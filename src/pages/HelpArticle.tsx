import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, User, ThumbsUp, ThumbsDown, BookOpen, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { QuickRating } from '@/components/common/FeedbackWidget';

// Article content database
const ARTICLES: Record<string, {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  readTime: string;
  lastUpdated: string;
  content: string;
  relatedArticles: string[];
  tags: string[];
}> = {
  'create-dream-job': {
    id: 'create-dream-job',
    title: 'How to create and customize your dream job profile',
    category: 'career',
    categoryLabel: 'Career Tools',
    readTime: '5 min read',
    lastUpdated: '2024-01-15',
    tags: ['dream jobs', 'career planning', 'setup'],
    relatedArticles: ['gap-analysis', 'skill-matching', 'career-recommendations'],
    content: `
# Creating Your Dream Job Profile

Your dream job profile is the foundation of SyllabusStack's career planning tools. Here's how to set it up for the best results.

## Step 1: Access Dream Jobs

Navigate to **Career** > **Dream Jobs** tab or click the "Add Dream Job" button on your dashboard.

## Step 2: Search for Job Titles

Use the search bar to find job titles that interest you. Our database includes:
- Software Engineering roles (Frontend, Backend, Full Stack, DevOps)
- Data Science and Analytics positions
- Product Management roles
- Design positions (UX, UI, Product Design)
- And many more...

## Step 3: Customize Your Profile

Once you've selected a dream job, you can:
1. **Set a target date** - When do you want to be ready for this role?
2. **Prioritize skills** - Which skills matter most to you?
3. **Add notes** - Keep track of specific companies or variations you're interested in

## Step 4: Review Your Gap Analysis

After creating your dream job profile, SyllabusStack automatically:
- Compares your current skills to job requirements
- Identifies skill gaps with priority levels
- Creates a personalized learning path

## Tips for Best Results

- **Be specific**: "Senior Frontend Engineer" gives better results than just "Engineer"
- **Add multiple dream jobs**: Compare different career paths side by side
- **Update regularly**: Your dream job may evolve as you learn and grow
- **Check recommendations**: Review the suggested courses and certifications weekly

## Need More Help?

If you can't find your desired job title, contact support and we'll add it to our database.
    `,
  },
  'gap-analysis': {
    id: 'gap-analysis',
    title: 'Understanding your skill gap analysis',
    category: 'career',
    categoryLabel: 'Career Tools',
    readTime: '7 min read',
    lastUpdated: '2024-01-20',
    tags: ['gap analysis', 'skills', 'assessment'],
    relatedArticles: ['create-dream-job', 'skill-verification', 'learning-path'],
    content: `
# Understanding Your Skill Gap Analysis

Gap analysis is your roadmap from where you are to where you want to be. Here's how to interpret and act on your results.

## What is Gap Analysis?

Gap analysis compares your current verified skills against the requirements for your dream job. It identifies:

- **Skills you have** (with proficiency levels)
- **Skills you need** to acquire
- **Skills to improve** to reach required proficiency

## Reading Your Gap Analysis Report

### Match Score

Your overall match score (0-100%) indicates how close you are to being fully qualified. Here's what the scores mean:

| Score | Status | Action |
|-------|--------|--------|
| 80%+ | Strong Match | Focus on advancing skills |
| 60-79% | Good Progress | Continue current path |
| 40-59% | Building Foundation | Prioritize critical gaps |
| <40% | Early Stage | Focus on foundational skills |

### Skill Categories

Skills are organized into categories:
- **Technical Skills**: Programming, frameworks, tools
- **Soft Skills**: Communication, leadership, collaboration
- **Domain Knowledge**: Industry-specific expertise

### Priority Levels

Each gap is assigned a priority:
- **Critical**: Must-have skills blocking your progress
- **High**: Important skills that significantly impact match score
- **Medium**: Valuable skills that enhance your profile
- **Low**: Nice-to-have skills for differentiation

## Taking Action

1. **Start with Critical gaps**: These have the highest impact
2. **Follow recommended courses**: We've curated learning paths
3. **Verify skills as you learn**: Take assessments to update your profile
4. **Track progress weekly**: Watch your match score improve

## Recalculating Your Analysis

Your gap analysis automatically updates when:
- You complete a course
- You pass a skill assessment
- You add or modify dream jobs
- New job market data becomes available

Click "Refresh Analysis" to manually trigger an update.
    `,
  },
  'skill-verification': {
    id: 'skill-verification',
    title: 'How skill verification works',
    category: 'skills',
    categoryLabel: 'Skills & Verification',
    readTime: '6 min read',
    lastUpdated: '2024-01-18',
    tags: ['verification', 'skills', 'assessments'],
    relatedArticles: ['proctored-assessments', 'certificates', 'employer-verification'],
    content: `
# How Skill Verification Works

Verified skills carry more weight with employers and improve your career match scores. Here's how the verification process works.

## Verification Levels

### Self-Reported
- Added manually to your profile
- No verification badge
- Lower weight in matching algorithm

### Course-Verified
- Earned by completing relevant courses
- Shows course completion badge
- Medium weight in matching

### Assessment-Verified
- Passed a skill-specific assessment
- Shows verified badge with proficiency level
- Highest weight in matching

### Employer-Verified
- Confirmed by a current or former employer
- Premium verification badge
- Strongest signal to recruiters

## Taking Skill Assessments

1. Navigate to **Progress** > **Skills** tab
2. Click "Verify" next to any skill
3. Choose assessment type:
   - **Quick Quiz** (10 min): Basic proficiency check
   - **Full Assessment** (30-60 min): Comprehensive evaluation
   - **Proctored Exam** (varies): Identity-verified assessment

## Proficiency Levels

After assessment, you'll receive a proficiency level:

| Level | Score | Description |
|-------|-------|-------------|
| Beginner | 0-40% | Foundational understanding |
| Intermediate | 41-70% | Can apply with guidance |
| Advanced | 71-90% | Independent application |
| Expert | 91-100% | Can teach others |

## Verification Expiry

- Technical skills: Valid for 2 years
- Soft skills: Valid indefinitely
- Industry certifications: Follow issuer's policy

You'll receive reminders before verification expires.

## Employer Verification Portal

Employers can verify candidate skills through:
- API integration
- Batch verification uploads
- Individual credential checks

All verifications are cryptographically signed and tamper-proof.
    `,
  },
  'proctored-assessments': {
    id: 'proctored-assessments',
    title: 'Proctored assessment requirements',
    category: 'skills',
    categoryLabel: 'Skills & Verification',
    readTime: '4 min read',
    lastUpdated: '2024-01-22',
    tags: ['proctoring', 'assessments', 'identity'],
    relatedArticles: ['skill-verification', 'certificates', 'identity-verification'],
    content: `
# Proctored Assessment Requirements

Proctored assessments provide the highest level of skill verification. Here's what you need to know.

## Technical Requirements

### Hardware
- Computer with webcam (720p minimum)
- Microphone
- Stable internet connection (5+ Mbps)

### Software
- Modern browser (Chrome, Firefox, Edge, Safari)
- Screen sharing capability
- No VPN or proxy connections

### Environment
- Well-lit room
- Quiet space without interruptions
- Clear desk (no unauthorized materials)

## Identity Verification

Before starting a proctored exam:
1. Present a valid government-issued ID
2. Complete a face verification check
3. Perform a 360° room scan
4. Confirm your identity matches records

## During the Exam

### Allowed
- Scratch paper (provided digitally)
- Calculator (for math-related exams)
- Water in clear container

### Not Allowed
- Additional devices
- Other people in the room
- Leaving the camera view
- External resources (unless specified)

## What Happens If Flagged

Our AI proctor monitors for:
- Additional faces in frame
- Suspicious eye movements
- Audio anomalies
- Tab switching

If flagged, a human reviewer examines the footage. You may be asked to retake the exam if violations are confirmed.

## Accommodations

We support accessibility accommodations:
- Extended time
- Screen reader compatibility
- Breaks for medical needs
- Alternative verification methods

Contact support before scheduling to arrange accommodations.
    `,
  },
  'course-enrollment': {
    id: 'course-enrollment',
    title: 'How to enroll in courses',
    category: 'courses',
    categoryLabel: 'Courses & Learning',
    readTime: '3 min read',
    lastUpdated: '2024-01-10',
    tags: ['enrollment', 'courses', 'getting started'],
    relatedArticles: ['track-progress', 'learning-path', 'course-completion'],
    content: `
# How to Enroll in Courses

Getting started with courses on SyllabusStack is straightforward. Here's your step-by-step guide.

## Finding Courses

### From Learn Page
1. Go to **Learn** in the navigation
2. Browse by category or use search
3. Filter by skill level, duration, or format

### From Recommendations
1. Check your **Career** > **Actions** tab
2. AI-curated courses based on your gaps
3. Click "Enroll" on any recommended course

### From Gap Analysis
1. View your gap analysis for any dream job
2. Click on a skill gap
3. See courses that address that skill

## Enrollment Options

### Free Courses
- Click "Enroll Free"
- Instant access to all materials
- No payment required

### Paid Courses
- Click "Enroll"
- Choose payment method
- One-time or subscription access

### Organization-Provided
- If your organization partners with us
- Courses may be pre-assigned
- Check "My Courses" for access

## After Enrollment

Once enrolled, you can:
- Access course materials immediately
- Track progress on your dashboard
- Set learning reminders
- Download resources (where available)

## Managing Enrollments

To manage your courses:
1. Go to **Learn** > **My Courses**
2. View active, completed, and saved courses
3. Unenroll or archive as needed

## Enrollment Limits

- Free plan: 3 active courses
- Pro plan: Unlimited courses
- Organization plan: Based on license
    `,
  },
  'track-progress': {
    id: 'track-progress',
    title: 'Tracking your learning progress',
    category: 'courses',
    categoryLabel: 'Courses & Learning',
    readTime: '4 min read',
    lastUpdated: '2024-01-12',
    tags: ['progress', 'tracking', 'dashboard'],
    relatedArticles: ['course-enrollment', 'achievements', 'learning-path'],
    content: `
# Tracking Your Learning Progress

Stay motivated and on track with our comprehensive progress tracking tools.

## Progress Dashboard

Your **Progress** page shows:

### Overview Stats
- Total courses enrolled
- Courses completed
- Skills verified
- Study hours logged

### Weekly Activity
- Learning streak (consecutive days)
- Time spent this week
- Objectives completed
- Assessments passed

### Skill Progress
- Skills by proficiency level
- Recently verified skills
- Expiring verifications

## Course Progress

Within each course:

### Progress Bar
Shows overall completion percentage based on:
- Content viewed
- Activities completed
- Assessments passed

### Module Tracking
- Check marks for completed modules
- Current module highlighted
- Time estimates for remaining content

### Learning Objectives
- Clear goals for each section
- Auto-tracking when objectives met
- Manual completion option

## Achievements System

Earn badges and rewards for:
- Completing courses
- Learning streaks
- Skill verifications
- Community participation

View all achievements in **Progress** > **Achievements** tab.

## Export Your Data

Download your learning history:
1. Go to **Settings** > **Data Export**
2. Select date range
3. Choose format (PDF, CSV, JSON)
4. Download or email report

Use exports for:
- Resume building
- LinkedIn updates
- Personal records
- Employer verification
    `,
  },
  'account-setup': {
    id: 'account-setup',
    title: 'Setting up your account',
    category: 'account',
    categoryLabel: 'Account & Settings',
    readTime: '5 min read',
    lastUpdated: '2024-01-08',
    tags: ['account', 'setup', 'getting started'],
    relatedArticles: ['profile-settings', 'notification-settings', 'privacy-settings'],
    content: `
# Setting Up Your Account

A complete profile helps you get the most from SyllabusStack. Here's how to set everything up.

## Basic Information

Navigate to **Profile** to update:

### Personal Details
- Full name
- Professional headline
- Location
- Bio/summary

### Contact Information
- Email (used for notifications)
- Phone (optional, for 2FA)
- LinkedIn profile URL

### Profile Photo
- Upload a professional photo
- Recommended: 400x400 pixels
- Formats: JPG, PNG, WebP

## Career Information

### Current Role
- Job title
- Company/organization
- Industry
- Years of experience

### Education
- Add degrees and certifications
- Include relevant coursework
- Import from LinkedIn (coming soon)

### Skills
- Add your existing skills
- Set proficiency levels
- Get skills verified

## Learning Preferences

In **Settings** > **Preferences**:

### Learning Style
- Preferred content format (video, text, interactive)
- Daily study time goal
- Reminder preferences

### Focus Areas
- Primary career interest
- Secondary interests
- Skills to prioritize

## Privacy Settings

Control who sees your information:

### Profile Visibility
- Public: Anyone can view
- Connections: Only connections
- Private: Only you

### Activity Sharing
- Learning activity
- Achievements
- Course completions

### Employer Visibility
- Allow recruiter searches
- Share verified credentials
- Job interest status

## Complete Onboarding

If you skipped onboarding, revisit it:
1. Click your avatar
2. Select "Complete Setup"
3. Follow the guided process
    `,
  },
  'billing-plans': {
    id: 'billing-plans',
    title: 'Understanding billing and plans',
    category: 'account',
    categoryLabel: 'Account & Settings',
    readTime: '6 min read',
    lastUpdated: '2024-01-25',
    tags: ['billing', 'plans', 'subscription'],
    relatedArticles: ['payment-methods', 'cancellation', 'refunds'],
    content: `
# Understanding Billing and Plans

Choose the plan that fits your learning journey. Here's a complete breakdown.

## Available Plans

### Free Plan
- 3 active course enrollments
- Basic skill tracking
- Limited assessments per month
- Community support

### Pro Plan - $19/month
- Unlimited course enrollments
- Full skill verification suite
- Priority assessment scheduling
- Email support
- Certificate generation

### Team Plan - $49/user/month
- Everything in Pro
- Team dashboards
- Admin controls
- Custom learning paths
- API access
- Dedicated support

### Enterprise - Custom pricing
- Everything in Team
- SSO integration
- Custom branding
- LMS integration
- SLA guarantees
- Success manager

## Billing Cycle

### Monthly Billing
- Charged on the same date each month
- Cancel anytime
- No long-term commitment

### Annual Billing
- Save 20% vs monthly
- Charged once per year
- Full refund within 30 days

## Managing Your Subscription

In **Settings** > **Billing**:

### Upgrade
1. Click "Upgrade Plan"
2. Select new plan
3. Confirm payment
4. Instant access to new features

### Downgrade
1. Click "Change Plan"
2. Select lower tier
3. Changes apply at next billing date
4. Keep access until then

### Cancel
1. Click "Cancel Subscription"
2. Complete cancellation survey
3. Access continues until period ends
4. Data retained for 30 days

## Payment Methods

We accept:
- Credit/debit cards (Visa, Mastercard, Amex)
- PayPal
- Bank transfer (Enterprise only)

Update payment methods anytime in billing settings.

## Invoices & Receipts

- Automatic email receipts
- Download invoices as PDF
- Access full billing history
- Export for expense reports
    `,
  },
};

// Get related article previews
const getRelatedArticles = (articleIds: string[]) => {
  return articleIds
    .map(id => ARTICLES[id])
    .filter(Boolean)
    .slice(0, 3);
};

export default function HelpArticlePage() {
  const { articleId } = useParams<{ articleId: string }>();
  const article = articleId ? ARTICLES[articleId] : null;

  if (!article) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The help article you're looking for doesn't exist or has been moved.
        </p>
        <Button asChild>
          <Link to="/help">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Help Center
          </Link>
        </Button>
      </div>
    );
  }

  const relatedArticles = getRelatedArticles(article.relatedArticles);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/help" className="hover:text-foreground transition-colors">
          Help Center
        </Link>
        <span>/</span>
        <span>{article.categoryLabel}</span>
      </nav>

      {/* Back button */}
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link to="/help">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Help Center
        </Link>
      </Button>

      {/* Article header */}
      <header className="mb-8">
        <Badge variant="secondary" className="mb-4">
          {article.categoryLabel}
        </Badge>
        <h1 className="text-3xl font-bold mb-4">{article.title}</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {article.readTime}
          </span>
          <span>Last updated: {new Date(article.lastUpdated).toLocaleDateString()}</span>
        </div>
      </header>

      {/* Article content */}
      <article className="prose prose-neutral dark:prose-invert max-w-none mb-12">
        {article.content.split('\n').map((line, i) => {
          if (line.startsWith('# ')) {
            return <h1 key={i} className="text-2xl font-bold mt-8 mb-4">{line.slice(2)}</h1>;
          }
          if (line.startsWith('## ')) {
            return <h2 key={i} className="text-xl font-semibold mt-6 mb-3">{line.slice(3)}</h2>;
          }
          if (line.startsWith('### ')) {
            return <h3 key={i} className="text-lg font-medium mt-4 mb-2">{line.slice(4)}</h3>;
          }
          if (line.startsWith('- ')) {
            return <li key={i} className="ml-4">{line.slice(2)}</li>;
          }
          if (line.startsWith('| ')) {
            // Simple table rendering
            const cells = line.split('|').filter(c => c.trim());
            return (
              <tr key={i} className="border-b">
                {cells.map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-sm">{cell.trim()}</td>
                ))}
              </tr>
            );
          }
          if (line.match(/^\d+\. /)) {
            return <li key={i} className="ml-4 list-decimal">{line.replace(/^\d+\. /, '')}</li>;
          }
          if (line.trim() === '') {
            return <br key={i} />;
          }
          // Handle bold text safely without dangerouslySetInnerHTML
          const parts = line.split(/\*\*(.+?)\*\*/g);
          return (
            <p key={i} className="mb-2">
              {parts.map((part, j) => 
                j % 2 === 1 ? <strong key={j}>{part}</strong> : part
              )}
            </p>
          );
        })}
      </article>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-8">
        {article.tags.map(tag => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </div>

      <Separator className="my-8" />

      {/* Feedback section */}
      <div className="bg-muted/50 rounded-lg p-6 mb-8">
        <h3 className="font-medium mb-2">Was this article helpful?</h3>
        <QuickRating
          feature={`help-article-${article.id}`}
          question=""
        />
      </div>

      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Related Articles</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedArticles.map(related => (
              <Card key={related.id} className="hover:bg-muted/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    <Link
                      to={`/help/article/${related.id}`}
                      className="hover:text-primary transition-colors flex items-start gap-2"
                    >
                      <BookOpen className="h-4 w-4 mt-1 flex-shrink-0" />
                      {related.title}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {related.readTime}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Contact support */}
      <Card className="mt-8 bg-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-medium">Still need help?</h3>
              <p className="text-sm text-muted-foreground">
                Our support team is here to assist you
              </p>
            </div>
            <Button asChild>
              <Link to="/help">
                <ExternalLink className="h-4 w-4 mr-2" />
                Contact Support
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
