# Developer Setup Guide

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+ or **pnpm**
- **Deno** 1.40+ (for edge functions)
- **Supabase CLI** 1.150+
- **Git**

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-org/syllabusstack.git
cd syllabusstack
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env.local
```

Required environment variables:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional: For local development
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Local Supabase Setup

### 1. Start Supabase

```bash
supabase start
```

This starts:
- PostgreSQL on port 54322
- Supabase Studio on port 54323
- Edge Functions on port 54321

### 2. Apply Migrations

```bash
supabase db push
```

### 3. Seed Data (Optional)

```bash
supabase db seed
```

### 4. Update Environment

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<local-anon-key>
```

Get local keys from `supabase status`.

## Edge Function Development

### Running Functions Locally

```bash
# All functions
supabase functions serve

# Specific function
supabase functions serve start-assessment
```

### Testing Functions

```bash
# Run Deno tests
cd supabase/functions
deno test --allow-all tests/
```

### Creating a New Function

```bash
supabase functions new my-function
```

Then follow the standard pattern:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createErrorResponse, createSuccessResponse, withErrorHandling } from "../_shared/error-handler.ts";

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  // Your logic here

  return createSuccessResponse({ message: "Hello" }, corsHeaders);
};

serve(withErrorHandling(handler, getCorsHeaders));
```

## Project Structure

```
syllabusstack/
├── src/
│   ├── components/     # React components
│   │   ├── ui/         # shadcn/ui components
│   │   ├── common/     # Shared components
│   │   ├── auth/       # Auth components
│   │   ├── career/     # Career features
│   │   ├── dashboard/  # Dashboard views
│   │   ├── instructor/ # Instructor features
│   │   ├── learn/      # Learning features
│   │   └── ...
│   ├── hooks/          # Custom React hooks
│   │   ├── assessment/ # Assessment hooks
│   │   ├── lectureSlides/ # Slide hooks
│   │   └── ...
│   ├── lib/            # Utilities
│   ├── pages/          # Route pages
│   ├── stores/         # Zustand stores
│   └── integrations/   # Supabase client
├── supabase/
│   ├── functions/      # Edge functions
│   │   ├── _shared/    # Shared utilities
│   │   ├── tests/      # Function tests
│   │   └── [function]/ # Each function
│   ├── migrations/     # Database migrations
│   └── config.toml     # Supabase config
├── docs/               # Documentation
└── public/             # Static assets
```

## Code Style Guidelines

### TypeScript

- Use strict mode (`"strict": true`)
- Avoid `any` - use `unknown` when needed
- Export types alongside implementations
- Use meaningful variable names

### React Components

```typescript
// Good: Functional component with TypeScript
interface Props {
  title: string;
  onSubmit: (data: FormData) => void;
}

export function MyComponent({ title, onSubmit }: Props) {
  // ...
}
```

### Hooks

```typescript
// Good: Hook with proper typing
export function useMyData(id: string) {
  return useQuery({
    queryKey: ['my-data', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('my_table')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}
```

### Edge Functions

- Always use CORS handler
- Always validate input with Zod
- Use rate limiting for AI/expensive operations
- Log with structured format

## Running Tests

### Frontend Tests

```bash
npm test
```

### Edge Function Tests

```bash
cd supabase/functions
deno test --allow-all tests/
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

## Building for Production

```bash
npm run build
```

Output is in `dist/` directory.

## Deployment

### Frontend (Vercel/Netlify)

1. Connect repository
2. Set environment variables
3. Deploy

### Edge Functions (Supabase)

```bash
supabase functions deploy
```

Or deploy specific function:

```bash
supabase functions deploy start-assessment
```

## Common Issues

### CORS Errors

Ensure the origin is in the whitelist in `_shared/cors.ts`.

### Rate Limiting

Free tier has limits. Check `_shared/rate-limiter.ts` for configurations.

### Database Connection

If database queries fail:
1. Check `SUPABASE_URL` is correct
2. Verify RLS policies
3. Check user authentication

### Build Failures

If TypeScript errors:
```bash
npm run typecheck
```

Fix all type errors before committing.

## Getting Help

- Check existing documentation in `docs/`
- Review edge function tests for examples
- Open an issue for bugs
