import { forwardRef } from "react";

// Testimonials section removed - we're just launching and don't have real user stories yet.
// This component returns null to maintain the import in Index.tsx without showing fake content.

export const TestimonialsSection = forwardRef<HTMLElement>(function TestimonialsSection(_props, ref) {
  return null;
});

TestimonialsSection.displayName = "TestimonialsSection";
