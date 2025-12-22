# CampusConnect Threads-Style Feed UI Refactor Prompt

## Goal
Redo the **visual design only** of the CampusConnect feed so posts look like **Threads-style posts**, while keeping **100% of existing functionality, logic, and behavior unchanged**.

This task is a **UI/UX refactor only**.

---

## Hard Rules (Must Follow)
- ❌ Do NOT change component logic, props, or state
- ❌ Do NOT change Firestore queries, listeners, or routes
- ❌ Do NOT change how media, maps, likes, comments, or redirects work
- ❌ Do NOT add new features or animations in this task
- ✅ Only modify layout, spacing, colors, and Tailwind classes

---

## Target Look
- Threads-style posts (text-first, minimal, flat)
- Dark-mode friendly
- No cards, no shadows, no heavy containers
- Subtle dividers between posts
- Calm spacing and clean typography

---

## Global Tailwind Tokens

### Colors
- Page background: `bg-black` or `bg-zinc-950`
- Primary text: `text-white`
- Body text: `text-white/90`
- Muted text: `text-white/60`
- Timestamp/meta: `text-white/50`
- Divider: `border-white/10`
- Hover row: `hover:bg-white/[0.03]`
- Icons: `text-white/70 hover:text-white`
- Links: `text-sky-400 hover:text-sky-300`

### Spacing & Layout
- Feed padding: `px-4 sm:px-6 lg:px-8`
- Post vertical padding: `py-4`
- Avatar gap: `gap-3`
- Content spacing: `space-y-2.5`
- Media margin-top: `mt-2`
- Actions margin-top: `mt-3`

### Sizes
- Avatar: `h-10 w-10 rounded-full`
- Feed max width: `max-w-[680px]`
- Right sidebar width: `w-[360px] xl:w-[400px]`
- Media corners: `rounded-xl`

---

## Page Layout (CampusConnect)

### Desktop Grid
Use a 3-column grid:
```
grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_360px]
```

Rules:
- Center feed must use `min-w-0`
- Feed content must be centered
- Right sidebar must remain active and scroll independently
- Media must not push sidebar off-screen

---

## Feed Column
- Wrapper: `min-w-0`
- Inner container:
  - `mx-auto w-full max-w-[680px] px-4 sm:px-6 lg:px-8`
- Do NOT apply `overflow-hidden` to feed wrapper

---

## PostCard (Threads-Style)

### Root
```
group relative py-4 border-b border-white/10 hover:bg-white/[0.03]
```

### Layout
```
flex items-start gap-3
```

### Avatar Column
- `shrink-0 self-start`
- Avatar: `h-10 w-10 rounded-full`

### Content Column
- `flex-1 min-w-0`
- Stack: `space-y-2.5`

---

## Post Header
- Layout:
```
flex items-center gap-2 min-w-0
```

- Username:
```
text-sm font-semibold text-white truncate
```

- Timestamp:
```
text-xs text-white/50
```

- Menu:
```
ml-auto shrink-0 text-white/60 hover:text-white
```

---

## Post Body
```
text-sm leading-relaxed text-white/90 whitespace-pre-wrap
```

---

## Media (Images / Maps)
- Keep existing MediaHorizontalScroll component EXACTLY
- Do NOT change logic, sizing, or behavior
- Wrapper only:
```
mt-2
```

Rules:
- Parent content column must be `min-w-0`
- Do NOT add `overflow-hidden` to post root or feed
- Media scroll controls its own horizontal overflow

---

## Actions Row
- Layout:
```
mt-3 flex items-center gap-2
```

- Buttons:
```
h-9 px-2 rounded-md hover:bg-white/[0.06]
```

- Icons:
```
text-white/70 hover:text-white
```

- Counts:
```
text-xs text-white/60
```

---

## Dividers
- Use only:
```
border-b border-white/10
```
- No cards, no shadows, no rounded containers

---

## Right Sidebar
- Keep behavior unchanged
- Visual:
```
border-l border-white/10 bg-black
```

- Scroll:
```
h-[calc(100vh-<headerHeight>)] overflow-y-auto
```

---

## Required Layout Fixes
- Add `min-w-0` to:
  - Feed column
  - Post content column
- Remove `overflow-hidden` from any parent wrapping feed
- Ensure sidebar remains active and visible on desktop

---

## Deliverables
1. Threads-style feed UI
2. Stable centered feed with sidebars intact
3. Media scroll unchanged and fully visible
4. Zero functional changes

---

## Instruction
Implement exactly as described.  
Do not ask clarifying questions.
