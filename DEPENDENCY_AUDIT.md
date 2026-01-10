# Dependency Audit Report

**Date:** January 2026
**Project:** SyllabusStack

## Executive Summary

This audit identified **7 security vulnerabilities**, **2 unused dependencies**, and numerous outdated packages. Immediate action is recommended to address security issues.

---

## 1. Security Vulnerabilities

| Package | Severity | Issue | CVE/Advisory |
|---------|----------|-------|--------------|
| react-router-dom (6.30.1) | **HIGH** | XSS via Open Redirects | GHSA-2w69-qvjg-hvjx |
| @remix-run/router | **HIGH** | Transitive dep of react-router-dom | GHSA-2w69-qvjg-hvjx |
| esbuild (<=0.24.2) | MODERATE | Dev server unauthorized requests | GHSA-67mh-4wv8-2f99 |
| vite (<=6.1.6) | MODERATE | Depends on vulnerable esbuild | GHSA-67mh-4wv8-2f99 |
| glob (10.2.0-10.4.5) | **HIGH** | Command injection via CLI | GHSA-5j98-mcp5-4vw2 |
| js-yaml (4.0.0-4.1.0) | MODERATE | Prototype pollution in merge | GHSA-mh29-5h37-fv8m |

### Fix Command
```bash
npm audit fix
```

---

## 2. Unused Dependencies (Remove)

These packages are in `package.json` but have **zero imports** in the codebase:

| Package | Version | Reason |
|---------|---------|--------|
| @tanstack/react-router | ^1.141.6 | `react-router-dom` is the actual router used |
| @tanstack/zod-form-adapter | ^0.42.1 | Forms use `@hookform/resolvers` with zod instead |

### Removal Command
```bash
npm uninstall @tanstack/react-router @tanstack/zod-form-adapter
```

**Estimated savings:** ~200KB+ from node_modules, faster install times.

---

## 3. Outdated Packages

### Major Version Updates (Breaking Changes Expected)

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| react / react-dom | 18.3.1 | 19.2.3 | React 19 - major changes |
| react-router-dom | 6.30.1 | 7.12.0 | Complete rewrite in v7 |
| zod | 3.25.76 | 4.3.5 | Major API changes |
| date-fns | 3.6.0 | 4.1.0 | Some API changes |
| recharts | 2.15.4 | 3.6.0 | Chart component changes |
| react-day-picker | 8.10.1 | 9.13.0 | API overhaul |
| tailwind-merge | 2.6.0 | 3.4.0 | Some breaking changes |
| sonner | 1.7.4 | 2.0.7 | Toast API changes |
| vaul | 0.9.9 | 1.1.2 | Now stable |
| react-resizable-panels | 2.1.9 | 4.3.3 | Significant updates |
| @hookform/resolvers | 3.10.0 | 5.2.2 | Check compatibility |

### Minor/Patch Updates (Generally Safe)

| Package | Current | Latest |
|---------|---------|--------|
| @supabase/supabase-js | 2.89.0 | 2.90.1 |
| @tanstack/react-query | 5.83.0 | 5.90.16 |
| @tanstack/react-form | 1.27.5 | 1.27.7 |
| lucide-react | 0.462.0 | 0.562.0 |
| next-themes | 0.3.0 | 0.4.6 |
| react-hook-form | 7.61.1 | 7.70.0 |
| All @radix-ui/* packages | Various | Minor updates available |

---

## 4. Potential Bloat

### Form Library Duplication
The project uses **both** form libraries:
- `react-hook-form` - Used in Auth.tsx, ResetPassword.tsx, ForgotPassword.tsx
- `@tanstack/react-form` - Used in LoginForm.tsx, SignupForm.tsx, Profile.tsx, etc.

**Recommendation:** Consider consolidating to a single form library for consistency and reduced bundle size.

### UI Components
All 26 Radix UI packages are actively used by shadcn/ui components. These are well tree-shaken and appropriate for the project.

---

## 5. Recommended Action Plan

### Immediate (Do Now)
1. Run `npm audit fix` to address security vulnerabilities
2. Remove unused dependencies:
   ```bash
   npm uninstall @tanstack/react-router @tanstack/zod-form-adapter
   ```

### Short-term (This Week)
1. Update react-router-dom to 6.30.3 (security fix, same major version)
2. Update all @radix-ui packages to latest minor versions
3. Update @supabase/supabase-js, @tanstack/react-query, lucide-react

### Medium-term (This Month)
1. Update vite to 6.x (test build process thoroughly)
2. Update tailwind-merge to v3
3. Update sonner and vaul to latest major versions
4. Evaluate consolidating form libraries

### Long-term (Plan Carefully)
1. React 19 migration (wait for ecosystem stability)
2. react-router-dom v7 migration (significant rewrite)
3. zod v4 migration (test all validations)
4. recharts v3 migration (update chart components)

---

## 6. Verification Commands

```bash
# Check for vulnerabilities
npm audit

# Check outdated packages
npm outdated

# Verify no unused dependencies after removal
npx depcheck
```

---

## Summary

| Category | Count | Priority |
|----------|-------|----------|
| Security vulnerabilities | 7 | **Critical** |
| Unused dependencies | 2 | High |
| Major version updates | 11 | Medium |
| Minor updates | 30+ | Low |
