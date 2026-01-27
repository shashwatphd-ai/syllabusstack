import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  BookOpen,
  GraduationCap,
  Target,
  Award,
  Users,
  Settings,
  CreditCard,
  Shield,
  MessageCircle,
  ChevronRight,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: typeof BookOpen;
  articles: HelpArticle[];
}

interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  popular?: boolean;
}

const helpCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of using SyllabusStack',
    icon: BookOpen,
    articles: [
      { id: 'create-account', title: 'Creating your account', summary: 'Sign up and set up your profile', popular: true },
      { id: 'first-course', title: 'Enrolling in your first course', summary: 'How to join a course using an access code' },
      { id: 'navigation', title: 'Navigating the platform', summary: 'Understanding the main sections' },
      { id: 'mobile-app', title: 'Using on mobile devices', summary: 'Access SyllabusStack on the go' },
    ],
  },
  {
    id: 'learning',
    title: 'Learning & Courses',
    description: 'Taking courses and tracking progress',
    icon: GraduationCap,
    articles: [
      { id: 'course-content', title: 'Accessing course content', summary: 'Videos, readings, and interactive materials' },
      { id: 'assessments', title: 'Taking assessments', summary: 'Tests, quizzes, and skill verification', popular: true },
      { id: 'progress-tracking', title: 'Tracking your progress', summary: 'Understanding your learning journey' },
      { id: 'learning-path', title: 'Following your learning path', summary: 'Visual guide to your courses' },
    ],
  },
  {
    id: 'career',
    title: 'Career & Skills',
    description: 'Dream jobs, gap analysis, and recommendations',
    icon: Target,
    articles: [
      { id: 'dream-jobs', title: 'Setting dream jobs', summary: 'Add careers you\'re interested in', popular: true },
      { id: 'gap-analysis', title: 'Understanding gap analysis', summary: 'What skills do you need?' },
      { id: 'recommendations', title: 'Personalized recommendations', summary: 'Content suggested for you' },
      { id: 'career-matching', title: 'Career matching algorithm', summary: 'How we calculate your match score' },
    ],
  },
  {
    id: 'certificates',
    title: 'Certificates & Verification',
    description: 'Earning and sharing credentials',
    icon: Award,
    articles: [
      { id: 'earn-certificate', title: 'Earning certificates', summary: 'Complete courses to get certified' },
      { id: 'verified-skills', title: 'Verified skills explained', summary: 'Skills confirmed through assessments' },
      { id: 'share-certificate', title: 'Sharing your certificates', summary: 'Share with employers and LinkedIn' },
      { id: 'id-verification', title: 'Identity verification', summary: 'Proctored assessments and ID checks' },
    ],
  },
  {
    id: 'instructors',
    title: 'For Instructors',
    description: 'Creating and managing courses',
    icon: Users,
    articles: [
      { id: 'create-course', title: 'Creating a course', summary: 'Set up your first course' },
      { id: 'add-content', title: 'Adding content', summary: 'Upload videos, PDFs, and assessments' },
      { id: 'student-management', title: 'Managing students', summary: 'Enrollments, gradebook, and messaging' },
      { id: 'analytics', title: 'Course analytics', summary: 'Understanding student performance' },
    ],
  },
  {
    id: 'account',
    title: 'Account & Settings',
    description: 'Profile, preferences, and security',
    icon: Settings,
    articles: [
      { id: 'profile', title: 'Editing your profile', summary: 'Update personal information' },
      { id: 'notifications', title: 'Notification settings', summary: 'Control what alerts you receive' },
      { id: 'password', title: 'Changing your password', summary: 'Keep your account secure' },
      { id: 'delete-account', title: 'Deleting your account', summary: 'How to remove your data' },
    ],
  },
  {
    id: 'billing',
    title: 'Billing & Subscriptions',
    description: 'Plans, payments, and invoices',
    icon: CreditCard,
    articles: [
      { id: 'plans', title: 'Subscription plans', summary: 'Free vs Pro features' },
      { id: 'payment-methods', title: 'Payment methods', summary: 'Cards and billing info' },
      { id: 'invoices', title: 'Viewing invoices', summary: 'Access your payment history' },
      { id: 'cancel', title: 'Canceling subscription', summary: 'How to cancel and what happens' },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & Security',
    description: 'Data protection and safety',
    icon: Shield,
    articles: [
      { id: 'data-privacy', title: 'Your data privacy', summary: 'How we protect your information' },
      { id: 'data-export', title: 'Exporting your data', summary: 'Download all your information' },
      { id: 'two-factor', title: 'Two-factor authentication', summary: 'Extra security for your account' },
      { id: 'report-issue', title: 'Reporting security issues', summary: 'Found a vulnerability?' },
    ],
  },
];

const popularArticles: HelpArticle[] = [
  { id: 'create-account', title: 'Creating your account', summary: 'Sign up and set up your profile' },
  { id: 'first-course', title: 'Enrolling in your first course', summary: 'How to join a course' },
  { id: 'assessments', title: 'Taking assessments', summary: 'Tests and skill verification' },
  { id: 'dream-jobs', title: 'Setting dream jobs', summary: 'Add careers you want' },
  { id: 'earn-certificate', title: 'Earning certificates', summary: 'Complete courses to get certified' },
];

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = searchQuery
    ? helpCategories.filter(cat =>
        cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.articles.some(a =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.summary.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : helpCategories;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      {/* Hero Section */}
      <div className="bg-primary text-primary-foreground py-16 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">How can we help you?</h1>
          <p className="text-lg opacity-90 mb-8">
            Search our knowledge base or browse categories below
          </p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search for help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 text-lg bg-background text-foreground"
            />
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto py-12 px-4 space-y-12">
        {/* Popular Articles */}
        {!searchQuery && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Popular Articles</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {popularArticles.map((article) => (
                <Link
                  key={article.id}
                  to={`/help/${article.id}`}
                  className="block"
                >
                  <Card className="h-full hover:shadow-md transition-shadow hover:border-primary/50">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium mb-1">{article.title}</h3>
                          <p className="text-sm text-muted-foreground">{article.summary}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        <section>
          <h2 className="text-xl font-semibold mb-4">
            {searchQuery ? 'Search Results' : 'Browse by Category'}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {filteredCategories.map((category) => {
              const Icon = category.icon;
              const filteredArticles = searchQuery
                ? category.articles.filter(a =>
                    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    a.summary.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                : category.articles;

              if (searchQuery && filteredArticles.length === 0) return null;

              return (
                <Card key={category.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{category.title}</CardTitle>
                        <CardDescription>{category.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {filteredArticles.slice(0, 4).map((article) => (
                        <li key={article.id}>
                          <Link
                            to={`/help/${article.id}`}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors group"
                          >
                            <span className="text-sm group-hover:text-primary transition-colors">
                              {article.title}
                            </span>
                            {article.popular && (
                              <Badge variant="secondary" className="text-xs">Popular</Badge>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {category.articles.length > 4 && !searchQuery && (
                      <Link
                        to={`/help/category/${category.id}`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                      >
                        View all {category.articles.length} articles
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {searchQuery && filteredCategories.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No results found</h3>
                <p className="text-muted-foreground mb-4">
                  We couldn't find any articles matching "{searchQuery}"
                </p>
                <Button variant="outline" onClick={() => setSearchQuery('')}>
                  Clear search
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Contact Support */}
        <section>
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="py-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/20 rounded-full">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Still need help?</h3>
                    <p className="text-muted-foreground">
                      Our support team is here to assist you
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" asChild>
                    <a href="mailto:support@syllabusstack.com">
                      <Mail className="h-4 w-4 mr-2" />
                      Email Support
                    </a>
                  </Button>
                  <Button asChild>
                    <Link to="/feedback">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Send Feedback
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Quick Links */}
        <section className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <a
                href="https://github.com/syllabusstack/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-medium group-hover:text-primary transition-colors">
                    Developer Docs
                  </h4>
                  <p className="text-sm text-muted-foreground">API and integration guides</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Link to="/legal" className="flex items-center justify-between group">
                <div>
                  <h4 className="font-medium group-hover:text-primary transition-colors">
                    Legal & Privacy
                  </h4>
                  <p className="text-sm text-muted-foreground">Terms, privacy, and policies</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <a
                href="https://status.syllabusstack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-medium group-hover:text-primary transition-colors">
                    System Status
                  </h4>
                  <p className="text-sm text-muted-foreground">Check service availability</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
