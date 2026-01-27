# Dependency Audit Report

**Assessment Date:** January 26, 2026
**Total Dependencies:** 607 (387 prod, 168 dev, 111 optional)

---

## Executive Summary

| Category | Count |
|----------|-------|
| Total Vulnerabilities | 6 |
| Critical | 0 |
| High | 2 |
| Moderate | 4 |
| Outdated Packages | 62 |
| Major Version Behind | 12 |

**Overall Risk Level:** Medium

---

## Vulnerability Analysis

### High Severity (2)

#### VULN-001: glob - Command Injection
- **Package:** glob (10.2.0 - 10.4.5)
- **CVE:** GHSA-5j98-mcp5-4vw2
- **CVSS:** 7.5
- **Description:** Command injection via -c/--cmd executes matches with shell:true
- **Fix Available:** Yes (upgrade to 10.5.0+)
- **Impact:** Build tooling only (not shipped to production)

#### VULN-002: seroval - Multiple Critical Issues
- **Package:** seroval (<=1.4.0)
- **CVEs:**
  - GHSA-66fc-rw6m-c2q6 (DoS via Array serialization)
  - GHSA-hx9m-jf43-8ffr (DoS via RegExp serialization)
  - GHSA-3rxj-6cgf-8cfw (RCE via JSON deserialization)
  - GHSA-hj76-42vx-jwp4 (Prototype pollution)
  - GHSA-3j22-8qj3-26mx (DoS via deeply nested objects)
- **CVSS:** 7.3-7.5
- **Description:** Multiple serialization vulnerabilities
- **Fix Available:** Yes (upgrade to 1.4.1+)
- **Impact:** Could affect SSR if seroval is used

---

### Moderate Severity (4)

#### VULN-003: vite - Multiple Path Traversal Issues
- **Package:** vite (<=6.1.6)
- **CVEs:**
  - GHSA-g4jq-h2w9-997c (Public directory path confusion)
  - GHSA-jqfw-vq24-v9c3 (HTML file fs settings bypass)
  - GHSA-93m4-6634-74q7 (Windows backslash bypass)
- **CVSS:** Low-Moderate
- **Description:** Development server file access issues
- **Fix Available:** Yes (upgrade to 6.1.7+)
- **Impact:** Development only - not shipped to production

#### VULN-004: esbuild - CORS Issue
- **Package:** esbuild (<=0.24.2)
- **CVE:** GHSA-67mh-4wv8-2f99
- **CVSS:** 5.3
- **Description:** Development server allows cross-origin requests
- **Fix Available:** Yes (upgrade to 0.24.3+)
- **Impact:** Development only

#### VULN-005: js-yaml - Prototype Pollution
- **Package:** js-yaml (4.0.0 - 4.1.0)
- **CVE:** GHSA-mh29-5h37-fv8m
- **CVSS:** 5.3
- **Description:** Prototype pollution in merge operator
- **Fix Available:** Yes (upgrade to 4.1.1+)
- **Impact:** Low - requires crafted YAML input

#### VULN-006: lodash - Prototype Pollution
- **Package:** lodash (4.0.0 - 4.17.21)
- **CVE:** GHSA-xxjr-mmjv-4gpg
- **CVSS:** 6.5
- **Description:** Prototype pollution in unset/omit functions
- **Fix Available:** Yes (upgrade to 4.17.22+)
- **Impact:** Indirect dependency - review usage

---

## Outdated Packages

### Major Version Updates Available (12)

| Package | Current | Latest | Breaking Changes |
|---------|---------|--------|------------------|
| @hookform/resolvers | 3.10.0 | 5.2.2 | API changes |
| date-fns | 3.6.0 | 4.1.0 | Tree-shaking changes |
| eslint-plugin-react-hooks | 5.2.0 | 7.0.1 | Rule changes |
| globals | 15.15.0 | 17.1.0 | Export format |
| next-themes | 0.3.0 | 0.4.6 | Provider changes |
| react | 18.3.1 | 19.2.4 | Major React changes |
| react-dom | 18.3.1 | 19.2.4 | Major React changes |
| react-day-picker | 8.10.1 | 9.13.0 | Component API |
| react-resizable-panels | 2.1.9 | 4.5.2 | API changes |
| recharts | 2.15.4 | 3.7.0 | Chart API |
| tailwind-merge | 2.6.0 | 3.4.0 | Merge logic |
| tailwindcss | 3.4.17 | 4.1.18 | Major overhaul |
| vaul | 0.9.9 | 1.1.2 | Drawer API |
| vite | 5.4.19 | 7.3.1 | Build config |
| zod | 3.25.76 | 4.3.6 | Schema API |

### Minor/Patch Updates Available (50+)

Most Radix UI packages, TanStack packages, and tooling have minor updates available.

---

## Recommendations

### Immediate (P0) - Security Fixes

```bash
# Fix all automatically fixable vulnerabilities
npm audit fix

# If automatic fix doesn't work, update specific packages:
npm install vite@latest esbuild@latest glob@latest lodash@latest js-yaml@latest
```

### High Priority (P1) - Stability Updates

```bash
# Update TanStack packages (no breaking changes expected)
npm install @tanstack/react-query@latest @tanstack/react-form@latest

# Update Supabase client
npm install @supabase/supabase-js@latest

# Update dev tooling
npm install eslint@latest typescript@latest typescript-eslint@latest
```

### Medium Priority (P2) - Minor Updates

```bash
# Update all Radix UI packages
npm install @radix-ui/react-accordion@latest @radix-ui/react-dialog@latest ...

# Update React Hook Form
npm install react-hook-form@latest

# Update router
npm install react-router-dom@latest
```

### Future Planning (P3) - Major Upgrades

#### React 19 Upgrade
- Breaking changes in event system
- New compiler (requires opt-in)
- Updated hooks behavior
- **Recommendation:** Plan for Q2 2026

#### Tailwind CSS v4 Upgrade
- New configuration format
- PostCSS changes
- **Recommendation:** Wait for ecosystem stabilization

#### Zod v4 Upgrade
- New inference system
- Some schema API changes
- **Recommendation:** Test thoroughly before upgrade

---

## Bundle Impact Analysis

### Large Dependencies

| Package | Bundled Size (estimated) | Notes |
|---------|-------------------------|-------|
| recharts | ~200KB | Chart library |
| @supabase/supabase-js | ~150KB | Backend client |
| lucide-react | ~100KB (with tree-shaking) | Icon library |
| react-day-picker | ~50KB | Date picker |
| zod | ~40KB | Validation |

### Potential Bundle Optimizations

1. **lucide-react:** Ensure tree-shaking is working (import specific icons)
2. **recharts:** Consider lighter alternatives if not using all chart types
3. **date-fns:** v4 has better tree-shaking

---

## Dependency Health

### Well-Maintained Packages
- React, React Router, React Query - Active development
- Supabase - Active development, regular releases
- Radix UI - Active, security-focused
- Vite - Active development

### Packages to Monitor
- **embla-carousel-react:** Less frequent updates
- **input-otp:** Niche package, monitor for security
- **cmdk:** Monitor for React 19 compatibility

---

## Action Items Summary

| Priority | Action | Effort |
|----------|--------|--------|
| P0 | Run `npm audit fix` | Low |
| P0 | Update vite to 6.x | Low |
| P1 | Update TanStack packages | Low |
| P1 | Update Supabase client | Low |
| P2 | Update Radix UI packages | Medium |
| P2 | Update dev tooling | Low |
| P3 | Plan React 19 upgrade | High |
| P3 | Plan Tailwind v4 upgrade | Medium |

---

## Appendix: Full Outdated Package List

```
Package                          Current    Latest
@eslint/js                        9.32.0    9.39.2
@hookform/resolvers               3.10.0     5.2.2
@radix-ui/react-* (26 packages)   various   +1 minor
@supabase/supabase-js             2.89.0    2.93.1
@tailwindcss/typography           0.5.16    0.5.19
@tanstack/react-form              1.27.5    1.28.0
@tanstack/react-query             5.83.0   5.90.20
@tanstack/react-router           1.141.6  1.157.15
@testing-library/react            16.3.1    16.3.2
@types/node                      22.16.5   25.0.10
@types/react                     18.3.23    19.2.9
@types/react-dom                  18.3.7    19.2.3
@vitejs/plugin-react-swc          3.11.0     4.2.2
autoprefixer                     10.4.21   10.4.23
date-fns                           3.6.0     4.1.0
eslint                            9.32.0    9.39.2
eslint-plugin-react-hooks          5.2.0     7.0.1
eslint-plugin-react-refresh       0.4.20    0.4.26
globals                          15.15.0    17.1.0
lucide-react                     0.462.0   0.563.0
next-themes                        0.3.0     0.4.6
react                             18.3.1    19.2.4
react-day-picker                  8.10.1    9.13.0
react-dom                         18.3.1    19.2.4
react-hook-form                   7.61.1    7.71.1
react-resizable-panels             2.1.9     4.5.2
react-router-dom                  7.12.0    7.13.0
recharts                          2.15.4     3.7.0
sonner                             1.7.4     2.0.7
tailwind-merge                     2.6.0     3.4.0
tailwindcss                       3.4.17    4.1.18
typescript                         5.8.3     5.9.3
typescript-eslint                 8.38.0    8.54.0
vaul                               0.9.9     1.1.2
vite                              5.4.19     7.3.1
vitest                            4.0.17    4.0.18
zod                              3.25.76     4.3.6
```
