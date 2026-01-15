# Component Guide - SyllabusStack

This document describes the component architecture, hierarchy, and usage patterns.

## Table of Contents

1. [Component Organization](#component-organization)
2. [Layout Components](#layout-components)
3. [Page Components](#page-components)
4. [Feature Components](#feature-components)
5. [UI Components (shadcn-ui)](#ui-components)
6. [Hooks Reference](#hooks-reference)
7. [Component Patterns](#component-patterns)

---

## Component Organization

### Directory Structure

```
src/components/
├── ui/                     # shadcn-ui primitives (50+ components)
├── layout/                 # App shell, navigation
├── auth/                   # Authentication components
├── dashboard/              # Dashboard widgets
├── learn/                  # Learning interface
├── student/                # Student-specific
├── instructor/             # Instructor-specific
├── admin/                  # Admin-specific
├── recommendations/        # Recommendation displays
├── analysis/               # Gap analysis displays
├── assessment/             # Quiz components
├── slides/                 # Lecture slides
├── progress/               # Progress tracking
├── achievements/           # Achievement badges
├── forms/                  # Form components
├── landing/                # Marketing page
├── profile/                # Profile components
├── settings/               # Settings components
├── billing/                # Billing components
├── course/                 # Course-related
├── dream-job/              # Dream job components
├── capability/             # Capability displays
├── content/                # Content components
├── search/                 # Search components
├── modals/                 # Modal dialogs
└── common/                 # Shared utilities
```

---

## Layout Components

### AppShell

Main layout wrapper for authenticated pages.

**Location:** `src/components/layout/AppShell.tsx`

**Structure:**
```tsx
<AppShell>
  <Header />
  <div className="flex">
    <Sidebar />
    <main className="flex-1">
      {children}
    </main>
  </div>
</AppShell>
```

**Props:**
```typescript
interface AppShellProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}
```

---

### Header

Top navigation bar.

**Location:** `src/components/layout/Header.tsx`

**Contains:**
- Logo
- Navigation links
- User menu dropdown
- Notifications (if enabled)

---

### Sidebar

Left navigation panel.

**Location:** `src/components/layout/Sidebar.tsx`

**Navigation Items (by role):**

| Role | Items |
|------|-------|
| Student | Dashboard, Learn, Career, Profile |
| Instructor | Dashboard, Courses, Content, Students |
| Admin | Dashboard, Users, Courses, Reports, Settings |

---

## Page Components

### Dashboard Page

**Location:** `src/pages/Dashboard.tsx`

**Child Components:**
```
Dashboard
├── CapabilitySnapshot
│   └── CapabilityCard[]
├── DreamJobCards
│   └── DreamJobCard[]
├── ProgressWidget
│   └── ProgressBar
└── NextActionBanner
    └── ActionCard
```

---

### Learn Page

**Location:** `src/pages/Learn.tsx`

**Tabs:**
- Active (current courses)
- Transcript (completed)
- All Courses (search/browse)

**Child Components:**
```
Learn
├── Tabs
│   ├── TabsList
│   └── TabsTrigger[]
├── CourseList
│   └── CourseCard[]
├── AddCourseForm
│   ├── Input (title)
│   ├── FileUpload (syllabus)
│   └── Button (submit)
└── CourseSearch
    ├── SearchInput
    └── SearchResults
```

---

### CareerPath Page

**Location:** `src/pages/CareerPath.tsx`

**Tabs:**
- Jobs (manage dream jobs)
- Gaps (view gap analysis)
- Actions (recommendations)
- Don't Do (anti-recommendations)

**Child Components:**
```
CareerPath
├── Tabs
├── DreamJobList
│   └── DreamJobCard[]
├── GapAnalysisDisplay
│   ├── MatchScoreGauge
│   ├── OverlapsList
│   ├── GapsList
│   └── HonestAssessment
├── RecommendationsList
│   └── RecommendationCard[]
└── AntiRecommendations
    └── AntiRecCard[]
```

---

## Feature Components

### Dashboard Components

#### CapabilitySnapshot

Displays top user skills.

**Location:** `src/components/dashboard/CapabilitySnapshot.tsx`

```tsx
<CapabilitySnapshot
  capabilities={capabilities}
  maxDisplay={5}
/>
```

---

#### DreamJobCards

Shows dream job cards with match scores.

**Location:** `src/components/dashboard/DreamJobCards.tsx`

```tsx
<DreamJobCards
  jobs={dreamJobs}
  onViewJob={handleViewJob}
  onEditJob={handleEditJob}
/>
```

---

#### ProgressWidget

Shows recommendation progress.

**Location:** `src/components/dashboard/ProgressWidget.tsx`

```tsx
<ProgressWidget
  total={recommendations.length}
  completed={completedCount}
  inProgress={inProgressCount}
/>
```

---

### Analysis Components

#### GapAnalysisDisplay

Full gap analysis visualization.

**Location:** `src/components/analysis/GapAnalysisDisplay.tsx`

```tsx
<GapAnalysisDisplay
  analysis={gapAnalysis}
  dreamJob={job}
  isLoading={isLoading}
/>
```

**Child Components:**
- `MatchScoreGauge` - Circular progress indicator
- `OverlapsList` - Skills that match
- `GapsList` - Skills to develop
- `HonestAssessment` - AI feedback text

---

#### MatchScoreGauge

Circular gauge showing match percentage.

**Location:** `src/components/analysis/MatchScoreGauge.tsx`

```tsx
<MatchScoreGauge
  score={85}
  readinessLevel={4}
/>
```

---

### Recommendation Components

#### RecommendationsList

Displays actionable recommendations.

**Location:** `src/components/recommendations/RecommendationsList.tsx`

```tsx
<RecommendationsList
  recommendations={recs}
  onStatusChange={handleStatusChange}
  onViewDetails={handleViewDetails}
/>
```

---

#### RecommendationCard

Individual recommendation card.

**Location:** `src/components/recommendations/RecommendationCard.tsx`

```tsx
<RecommendationCard
  recommendation={rec}
  onStart={handleStart}
  onComplete={handleComplete}
  onSkip={handleSkip}
/>
```

**Displays:**
- Priority badge
- Action title & description
- Steps breakdown
- Effort hours & cost
- Status controls

---

### Assessment Components

#### QuestionCard

Displays quiz question.

**Location:** `src/components/assessment/QuestionCard.tsx`

```tsx
<QuestionCard
  question={question}
  selectedAnswer={selected}
  onSelectAnswer={setSelected}
  showResult={submitted}
/>
```

---

#### AnswerOptions

Multiple choice options.

**Location:** `src/components/assessment/AnswerOptions.tsx`

```tsx
<AnswerOptions
  options={question.options}
  selected={selectedIndex}
  correctIndex={correctIndex}
  showCorrect={showResult}
  onSelect={handleSelect}
/>
```

---

### Form Components

#### AddCourseForm

Course creation form.

**Location:** `src/components/forms/AddCourseForm.tsx`

```tsx
<AddCourseForm
  onSubmit={handleSubmit}
  isSubmitting={mutation.isPending}
/>
```

**Fields:**
- Course title (required)
- Course code
- University
- Semester
- Syllabus file upload

---

#### AddDreamJobForm

Dream job input form.

**Location:** `src/components/forms/AddDreamJobForm.tsx`

```tsx
<AddDreamJobForm
  onSubmit={handleSubmit}
  isSubmitting={mutation.isPending}
/>
```

**Fields:**
- Job title/query (required)
- Company type (optional)
- Location (optional)

---

### Content Components

#### VideoPlayer

YouTube video player with controls.

**Location:** `src/components/content/VideoPlayer.tsx`

```tsx
<VideoPlayer
  videoId={video.id}
  title={video.title}
  onComplete={handleComplete}
/>
```

---

#### ContentList

List of learning materials.

**Location:** `src/components/content/ContentList.tsx`

```tsx
<ContentList
  items={materials}
  onItemClick={handleItemClick}
  showProgress={true}
/>
```

---

## UI Components

### shadcn-ui Components

All primitive UI components from shadcn-ui are in `src/components/ui/`.

| Component | Usage |
|-----------|-------|
| `Button` | Actions, form submissions |
| `Input` | Text input fields |
| `Label` | Form labels |
| `Card` | Content containers |
| `Dialog` | Modal dialogs |
| `Tabs` | Tab navigation |
| `Select` | Dropdown selections |
| `Badge` | Status indicators |
| `Progress` | Progress bars |
| `Skeleton` | Loading states |
| `Toast` | Notifications |
| `Tooltip` | Hover information |
| `Alert` | Messages |
| `Avatar` | User avatars |
| `Checkbox` | Boolean inputs |
| `RadioGroup` | Single selections |
| `Switch` | Toggle switches |
| `Textarea` | Multi-line input |
| `Separator` | Visual dividers |
| `ScrollArea` | Scrollable containers |
| `Sheet` | Side panels |
| `Popover` | Floating content |
| `Command` | Command palette |
| `Calendar` | Date picker |

### Button Variants

```tsx
<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="link">Link</Button>
```

### Card Usage

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
</Card>
```

---

## Hooks Reference

### Data Fetching Hooks

| Hook | Returns | Purpose |
|------|---------|---------|
| `useCourses()` | `{ data, isLoading }` | Fetch user courses |
| `useDreamJobs()` | `{ data, isLoading }` | Fetch dream jobs |
| `useAnalysis(jobId)` | `{ data, isLoading }` | Fetch gap analysis |
| `useRecommendations(jobId)` | `{ data, isLoading }` | Fetch recommendations |
| `useCapabilities()` | `{ data, isLoading }` | Fetch capabilities |
| `useProfile()` | `{ data, isLoading }` | Fetch user profile |
| `useDashboard()` | `{ data, isLoading }` | Fetch dashboard data |

### Mutation Hooks

| Hook | Purpose |
|------|---------|
| `useCreateCourse()` | Create new course |
| `useDeleteCourse()` | Delete course |
| `useAnalyzeSyllabus()` | Analyze syllabus |
| `useCreateDreamJob()` | Add dream job |
| `useDeleteDreamJob()` | Remove dream job |
| `useUpdateRecommendationStatus()` | Update rec status |
| `useStartAssessment()` | Start quiz |
| `useSubmitAnswer()` | Submit quiz answer |

### Utility Hooks

| Hook | Purpose |
|------|---------|
| `useAuth()` | Access auth context |
| `useToast()` | Show toast notifications |
| `useDebounce(value, delay)` | Debounce values |
| `useMobile()` | Check mobile breakpoint |
| `useLocalStorage(key, initial)` | Persist to localStorage |

### Hook Usage Examples

```tsx
// Fetching data
function CourseList() {
  const { data: courses, isLoading } = useCourses();

  if (isLoading) return <Skeleton />;

  return (
    <ul>
      {courses?.map(course => (
        <CourseCard key={course.id} course={course} />
      ))}
    </ul>
  );
}

// Mutations
function AddCourseButton() {
  const createCourse = useCreateCourse();

  const handleClick = async () => {
    await createCourse.mutateAsync({
      title: "New Course",
      code: "CS101"
    });
  };

  return (
    <Button
      onClick={handleClick}
      disabled={createCourse.isPending}
    >
      Add Course
    </Button>
  );
}
```

---

## Component Patterns

### Pattern 1: Container/Presentation

```tsx
// Container (fetches data, handles logic)
function CourseListContainer() {
  const { data, isLoading, error } = useCourses();
  const deleteCourse = useDeleteCourse();

  const handleDelete = async (id: string) => {
    await deleteCourse.mutateAsync(id);
  };

  return (
    <CourseList
      courses={data}
      isLoading={isLoading}
      onDelete={handleDelete}
    />
  );
}

// Presentation (pure rendering)
function CourseList({ courses, isLoading, onDelete }) {
  if (isLoading) return <LoadingState />;

  return (
    <ul>
      {courses.map(course => (
        <CourseCard
          key={course.id}
          course={course}
          onDelete={() => onDelete(course.id)}
        />
      ))}
    </ul>
  );
}
```

### Pattern 2: Compound Components

```tsx
// Usage
<Card>
  <Card.Header>
    <Card.Title>My Card</Card.Title>
  </Card.Header>
  <Card.Content>
    Content here
  </Card.Content>
  <Card.Footer>
    <Button>Action</Button>
  </Card.Footer>
</Card>
```

### Pattern 3: Render Props

```tsx
<DataFetcher
  queryKey={['courses']}
  queryFn={fetchCourses}
>
  {({ data, isLoading }) => (
    isLoading ? <Skeleton /> : <CourseList courses={data} />
  )}
</DataFetcher>
```

### Pattern 4: Loading States

```tsx
function AsyncComponent() {
  const { data, isLoading, error } = useData();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return <DataDisplay data={data} />;
}
```

### Pattern 5: Form Handling

```tsx
function MyForm() {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: ''
    }
  });

  const onSubmit = async (data) => {
    await mutation.mutateAsync(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

---

## Component Tree Visualization

```
App
├── QueryClientProvider
├── AuthProvider
└── BrowserRouter
    └── Routes
        │
        ├── "/" → Index (Landing)
        │   └── LandingPage
        │       ├── Hero
        │       ├── Features
        │       ├── Testimonials
        │       └── Footer
        │
        ├── "/auth" → Auth
        │   └── AuthPage
        │       ├── Tabs (Login/Signup)
        │       └── AuthForm
        │
        ├── "/onboarding" → Onboarding
        │   └── OnboardingWizard
        │       ├── Step1: ProfileForm
        │       ├── Step2: AddCourseForm
        │       ├── Step3: AddDreamJobForm
        │       └── Step4: Complete
        │
        └── AuthGuard
            └── AppShell
                ├── Header
                ├── Sidebar
                └── Main
                    │
                    ├── "/dashboard" → Dashboard
                    │   ├── CapabilitySnapshot
                    │   ├── DreamJobCards
                    │   ├── ProgressWidget
                    │   └── NextActionBanner
                    │
                    ├── "/learn" → Learn
                    │   ├── Tabs
                    │   ├── CourseList
                    │   └── AddCourseForm
                    │
                    └── "/career" → CareerPath
                        ├── Tabs
                        ├── DreamJobList
                        ├── GapAnalysisDisplay
                        └── RecommendationsList
```

---

## Best Practices

### 1. Component Naming

- PascalCase for components: `CourseCard`
- camelCase for hooks: `useCourses`
- kebab-case for files: `course-card.tsx`

### 2. Props Interface

```tsx
interface CourseCardProps {
  course: Course;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  showActions?: boolean;
}
```

### 3. Default Props

```tsx
function CourseCard({
  course,
  showActions = true,
  onEdit,
  onDelete
}: CourseCardProps) {
  // ...
}
```

### 4. Event Handlers

```tsx
// Prefix with "handle" in component
const handleSubmit = () => { ... };

// Prefix with "on" in props
<Form onSubmit={handleSubmit} />
```

### 5. Conditional Rendering

```tsx
// Guard clauses for loading/error
if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage error={error} />;
if (!data) return <EmptyState />;

return <DataDisplay data={data} />;
```
