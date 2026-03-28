# FQ Design System Skill

Read this before making ANY UI changes, 
adding new components, or styling anything.

---

## The Golden Rule

Never use generic Tailwind classes when an FQ 
token exists. The app has a custom design system 
— always use it.
```typescript
// CORRECT
className="bg-fq-bg text-fq-dark border-fq-border"

// WRONG
className="bg-gray-50 text-gray-900 border-gray-200"
```

---

## Color Tokens

| Token | Use |
|-------|-----|
| `fq-bg` | Page background — warm off-white |
| `fq-card` | Card/panel background — slightly warmer than bg |
| `fq-dark` | Primary text and dark buttons |
| `fq-muted` | Secondary text, labels, placeholders |
| `fq-border` | All borders and dividers |
| `fq-accent` | Accent color — used sparingly for highlights |

Usage with opacity modifiers:
```
text-fq-dark/90    — primary text
text-fq-muted/70   — secondary text  
text-fq-muted/40   — placeholder text
border-fq-border   — standard border
bg-fq-dark         — dark button background
bg-fq-card         — card background
```

---

## Typography

| Class | Use |
|-------|-----|
| `font-heading` | Headers, project names, section titles |
| `font-body` | All body text, labels, buttons |

Font sizes follow this scale:
```
text-[11px]  — micro labels, timestamps, captions
text-[12px]  — form labels, small tags
text-[13px]  — body text, button text, inputs
text-[14px]  — standard body, descriptions
text-[22px]  — modal headings
text-[28px]  — page headings
text-[32px]  — large headings
```

---

## Standard Components

### Cards
```tsx

  {/* content */}

```

### Buttons — Primary (dark)
```tsx

  Button Label

```

### Buttons — Secondary (outlined)
```tsx

  Button Label

```

### Pill/Badge
```tsx

  Label

```

### Input Fields
```tsx

```

### Dividers
```tsx

```

### Modals
```tsx

  
  
    {/* modal content */}
  

```

### Toast Notifications
Use the existing toast pattern — bottom right, 
auto-dismiss after 3-5 seconds. Match existing 
toast styling in the inbox.

---

## Status Colors

These are used consistently across the app:

| Status | Background | Text |
|--------|-----------|------|
| Success/Active | `bg-green-100` | `text-green-700` |
| Warning/Follow-up | `bg-amber-100` | `text-amber-700` |
| Info/Draft Ready | `bg-blue-100` | `text-blue-700` |
| Resolved | `bg-gray-100` | `text-gray-500` |
| Untagged | `bg-amber-50 border-l-4 border-amber-400` | `text-amber-700` |

---

## Spacing Conventions

- Card padding: `p-6` standard, `p-4` compact
- Section gaps: `gap-5` for card grids
- Form field gaps: `space-y-4`
- Small gaps: `gap-2`, `gap-3`
- Page padding: `py-10 px-10`

---

## Icons

Use `lucide-react` exclusively. Never use emoji 
as UI icons. Never use other icon libraries.
```typescript
import { Mail, Check, X, Clock, Reply, 
         Pencil, Calendar, Search } from 'lucide-react';

// Standard icon size

```

---

## Animations

Keep animations subtle and fast:
```
transition-colors   — for color changes
transition-all duration-300   — for layout shifts (sidebar)
hover:scale-110   — for small interactive elements only
```

No bouncy animations. No flashy transitions.
Calm is the luxury.

---

## Responsive Design

The app is primarily desktop-first.
Mobile optimization is a future phase.
Do not break desktop layout trying to fix mobile.
