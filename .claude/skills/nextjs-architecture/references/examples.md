# Full Page Scaffold Example

A complete example of a marketing homepage with 4 sections, following all architecture rules.

## File Tree

```
app/
  page.tsx
components/
  Hero/
    index.tsx
  Features/
    index.tsx
    FeatureCard.tsx
    Features.types.ts
  Testimonials/
    index.tsx
    useTestimonials.ts
    TestimonialCard.tsx
    Testimonials.types.ts
  Footer/
    index.tsx
```

---

## app/page.tsx

```tsx
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Testimonials from '@/components/Testimonials';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <Hero />
      <Features />
      <Testimonials />
      <Footer />
    </main>
  );
}
```

---

## components/Hero/index.tsx

```tsx
// No state needed — static section, Server Component
export default function Hero() {
  return (
    <section className="w-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold tracking-tight">Build faster.</h1>
        <p className="mt-4 text-xl text-blue-100">
          The Next.js starter built for scale.
        </p>
        <button className="mt-8 px-6 py-3 bg-white text-blue-700 font-semibold rounded-lg hover:bg-blue-50 transition">
          Get Started
        </button>
      </div>
    </section>
  );
}
```

---

## components/Features/Features.types.ts

```ts
export interface Feature {
  id: string;
  icon: string;
  title: string;
  description: string;
}
```

## components/Features/index.tsx

```tsx
import { Feature } from './Features.types';
import FeatureCard from './FeatureCard';

const features: Feature[] = [
  { id: '1', icon: '⚡', title: 'Fast', description: 'Optimized for performance.' },
  { id: '2', icon: '🔒', title: 'Secure', description: 'Built with security in mind.' },
  { id: '3', icon: '📦', title: 'Modular', description: 'Composable by design.' },
];

export default function Features() {
  return (
    <section className="w-full py-20 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900">Why us?</h2>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map(f => (
            <FeatureCard key={f.id} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

## components/Features/FeatureCard.tsx

```tsx
import { Feature } from './Features.types';

export default function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div className="w-full p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
      <span className="text-4xl">{feature.icon}</span>
      <h3 className="mt-4 text-lg font-semibold text-gray-800">{feature.title}</h3>
      <p className="mt-2 text-gray-500 text-sm">{feature.description}</p>
    </div>
  );
}
```

---

## components/Testimonials/Testimonials.types.ts

```ts
export interface Testimonial {
  id: string;
  name: string;
  role: string;
  quote: string;
  avatar: string;
}
```

## components/Testimonials/useTestimonials.ts

```ts
"use client";
import { useState } from 'react';
import { Testimonial } from './Testimonials.types';

const ALL_TESTIMONIALS: Testimonial[] = [
  { id: '1', name: 'Alice Chen', role: 'CTO @ Startup', quote: 'This saved us weeks.', avatar: 'AC' },
  { id: '2', name: 'Bob Martin', role: 'Lead Dev', quote: 'Best DX I have ever had.', avatar: 'BM' },
  { id: '3', name: 'Sara Kim', role: 'Founder', quote: 'Shipped in record time.', avatar: 'SK' },
];

export function useTestimonials() {
  const [active, setActive] = useState(0);
  const testimonial = ALL_TESTIMONIALS[active];
  const total = ALL_TESTIMONIALS.length;

  const next = () => setActive(i => (i + 1) % total);
  const prev = () => setActive(i => (i - 1 + total) % total);

  return { testimonial, active, total, next, prev };
}
```

## components/Testimonials/index.tsx

```tsx
"use client";
import { useTestimonials } from './useTestimonials';
import TestimonialCard from './TestimonialCard';

export default function Testimonials() {
  const { testimonial, active, total, next, prev } = useTestimonials();

  return (
    <section className="w-full bg-gray-50 py-20 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-gray-900">What people say</h2>
        <div className="mt-10">
          <TestimonialCard testimonial={testimonial} />
        </div>
        <div className="mt-6 flex justify-center gap-4">
          <button onClick={prev} className="px-4 py-2 rounded-lg bg-white border hover:bg-gray-100">←</button>
          <span className="py-2 text-gray-500 text-sm">{active + 1} / {total}</span>
          <button onClick={next} className="px-4 py-2 rounded-lg bg-white border hover:bg-gray-100">→</button>
        </div>
      </div>
    </section>
  );
}
```

## components/Testimonials/TestimonialCard.tsx

```tsx
import { Testimonial } from './Testimonials.types';

export default function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="w-full bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
      <p className="text-lg text-gray-700 italic">"{testimonial.quote}"</p>
      <div className="mt-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
          {testimonial.avatar}
        </div>
        <div className="text-left">
          <p className="font-semibold text-gray-800 text-sm">{testimonial.name}</p>
          <p className="text-gray-400 text-xs">{testimonial.role}</p>
        </div>
      </div>
    </div>
  );
}
```

---

## components/Footer/index.tsx

```tsx
export default function Footer() {
  return (
    <footer className="w-full bg-gray-900 text-gray-400 py-10 px-6 mt-auto">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm">© 2025 MyApp. All rights reserved.</p>
        <nav className="flex gap-6 text-sm">
          <a href="#" className="hover:text-white transition">Privacy</a>
          <a href="#" className="hover:text-white transition">Terms</a>
          <a href="#" className="hover:text-white transition">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
```