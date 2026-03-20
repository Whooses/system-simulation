---
name: nextjs-architecture
description: Use this skill whenever the user wants to build, scaffold, structure, or refactor a Next.js application. Triggers on requests like "create a Next.js app", "help me structure my Next.js project", "build a page/component in Next.js", "how should I organize my Next.js code", or any time the user is working on a Next.js project and asks about components, pages, hooks, or file organization. Also triggers when the user wants to refactor, clean up, reorganize, or improve existing Next.js or React code — including splitting large components, extracting hooks, moving logic out of UI, restructuring folders, or converting class components to functional ones. Always use this skill when Next.js is involved — don't rely on general React knowledge alone.
---

# Next.js Architecture Skill

You are an expert Next.js architect. When helping users build or structure Next.js apps, always follow the principles and patterns below. Generate real, working code when asked — don't just describe what to do.

---

## Core Principles

1. **Pages are thin** — they only compose section components, nothing else.
2. **Components own their internals** — state, logic, and sub-components stay inside their folder.
3. **Logic lives in hooks** — extract all state and business logic into custom `use*.ts` hooks.
4. **Parent controls layout, child fills space** — children use `w-full`, `h-full`, `flex-1`; parents use grid/flex.
5. **Server vs Client split** — default to Server Components; only add `"use client"` when you need interactivity or browser APIs.

---

## Folder Structure

Always scaffold projects with this structure:

```
app/
  page.tsx                  ← thin composition only
  layout.tsx
  globals.css
components/
  [ComponentName]/
    index.tsx               ← main component
    use[ComponentName].ts   ← logic & state (if needed)
    [ComponentName].types.ts← TypeScript types (if needed)
    [SubComponent].tsx      ← sub-components (if needed)
lib/
  utils.ts                  ← shared utility functions
  constants.ts              ← app-wide constants
types/
  index.ts                  ← shared global types
public/
```

For larger apps with multiple routes, group by feature:
```
app/
  (marketing)/
    page.tsx
    layout.tsx
  (dashboard)/
    page.tsx
    layout.tsx
components/
  marketing/
    Hero/
    Features/
  dashboard/
    Sidebar/
    StatsCard/
  shared/
    Button/
    Modal/
```

---

## Component Rules

### Page Component (thin composer)
```tsx
// app/page.tsx
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Pricing from '@/components/Pricing';

// No state. No logic. Just composition.
export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <Pricing />
    </>
  );
}
```

### Section Component (with extracted hook)
```tsx
// components/Pricing/index.tsx
"use client";
import { usePricing } from './usePricing';
import PricingCard from './PricingCard';

export default function Pricing() {
  const { plans, selectedPlan, handleSelect } = usePricing();

  return (
    <section className="w-full py-16 px-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map(plan => (
          <PricingCard
            key={plan.id}
            plan={plan}
            isSelected={plan.id === selectedPlan}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </section>
  );
}
```

### Custom Hook (logic lives here)
```ts
// components/Pricing/usePricing.ts
import { useState } from 'react';
import { Plan } from './Pricing.types';

export function usePricing() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const plans: Plan[] = [
    { id: 'starter', name: 'Starter', price: 9 },
    { id: 'pro', name: 'Pro', price: 29 },
    { id: 'enterprise', name: 'Enterprise', price: 99 },
  ];

  const handleSelect = (id: string) => setSelectedPlan(id);

  return { plans, selectedPlan, handleSelect };
}
```

### Presentational Sub-Component (no logic)
```tsx
// components/Pricing/PricingCard.tsx
import { Plan } from './Pricing.types';

interface Props {
  plan: Plan;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

// No state, no hooks — pure UI
export default function PricingCard({ plan, isSelected, onSelect }: Props) {
  return (
    <div
      className={`w-full p-6 rounded-xl border cursor-pointer transition-all
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
      onClick={() => onSelect(plan.id)}
    >
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <p className="text-2xl font-bold mt-2">${plan.price}/mo</p>
    </div>
  );
}
```

---

## Server vs Client Components

| Situation | Use |
|---|---|
| Fetching data, reading DB, no interactivity | Server Component (default) |
| `useState`, `useEffect`, event handlers | `"use client"` |
| Browser APIs (`window`, `localStorage`) | `"use client"` |
| Heavy computation, markdown rendering | Server Component |
| Forms with validation | `"use client"` |

**Pattern**: Keep the outer shell a Server Component for data fetching, pass data down to a Client Component for interactivity:

```tsx
// app/dashboard/page.tsx — Server Component
import StatsClient from '@/components/Stats/StatsClient';

export default async function DashboardPage() {
  const stats = await fetchStats(); // server-side fetch
  return <StatsClient initialStats={stats} />;
}
```

```tsx
// components/Stats/StatsClient.tsx — Client Component
"use client";
export default function StatsClient({ initialStats }) {
  const [stats, setStats] = useState(initialStats);
  // ... interactive logic
}
```

---

## Layout Rules (Tailwind)

- **Children** always use: `w-full`, `h-full`, `flex-1`, `min-h-0` — they fill what they're given
- **Parents** control: `grid grid-cols-X`, `flex`, `gap-X`, explicit widths
- **Responsive** breakpoints belong on the **parent**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Children **never** hardcode widths like `w-[600px]` unless it's a truly fixed-size UI element (e.g. avatar, icon)

---

## When Generating Code

1. Always generate the full folder structure first as a comment or tree view
2. Generate all files for a component together: `index.tsx`, `use[Name].ts`, `[Name].types.ts`
3. Use TypeScript — define interfaces/types in `[Name].types.ts`
4. Use Tailwind for all styling — no inline styles, no CSS files unless `globals.css`
5. Add `"use client"` only when strictly needed
6. Keep components under ~150 lines — if longer, split into sub-components

---

## Quick Reference: What Goes Where

| Code | Location |
|---|---|
| Page assembly | `app/page.tsx` |
| Section UI | `components/[Name]/index.tsx` |
| State & logic | `components/[Name]/use[Name].ts` |
| Sub-components | `components/[Name]/[Sub].tsx` |
| Shared types | `types/index.ts` |
| Shared utils | `lib/utils.ts` |
| API calls | `lib/api.ts` or Server Components |

For additional reference material, see:
- `references/examples.md` — full page scaffold example