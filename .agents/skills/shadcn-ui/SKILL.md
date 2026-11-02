---
name: shadcn-ui
description: "Trigger: shadcn, shadcn/ui, ui components, radix, design system, componentes de interfaz. Standardize UI development using Shadcn UI."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## Activation Contract

Activate this skill when:
- Creating, modifying, or refactoring user interfaces, components, or screens.
- Adding interactive elements: buttons, selects, dropdowns, dialogs, switches, badges, tooltips, or popovers.
- Auditing UI code for raw HTML tags (`<select>`, raw `<button>`, ad-hoc switch toggles) that should be replaced with canonical shadcn/ui components.

Do not activate for backend-only tasks, database migrations, or non-UI services.

## Hard Rules

- **Always use shadcn/ui primitives**: Never code custom raw HTML `<select>`, `<button>`, or hand-made switches when a shadcn/ui component exists or can be installed into `@/shared/components/ui/` (or `@/components/ui/`).
- **Prerequisites & Radix**: All components must be built on top of `@radix-ui` primitives, using `clsx` and `tailwind-merge` via `cn()` helper.
- **Accessible & Centered**: Switches must include `items-center` on the root track and `block` on the thumb. Selects must use Radix portal and popper positioning.
- **Component Placement**: All shared components live in `@/shared/components/ui/{component-name}.tsx` with export matching the canonical shadcn API.
- **Zero Raw Fallback**: If a component is missing, install the corresponding `@radix-ui/react-*` package and scaffold the official shadcn component before using it in views.

## Decision Gates

| Situation | Action |
| --- | --- |
| Need a click action or link styled as button | Use `<Button variant="..." size="...">` |
| Need a status tag, count, or chip | Use `<Badge variant="...">` |
| Need a selection dropdown | Use `<Select>`, `<SelectTrigger>`, `<SelectValue>`, `<SelectContent>`, `<SelectItem>` |
| Need an on/off boolean toggle | Use `<Switch checked={...} onCheckedChange={...}>` |
| Need a modal or drawer | Use `<Dialog>`, `<DialogContent>`, etc. |
| Need a form input or search field | Use `<Input ...>` |
| Need a content or KPI container | Use `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardContent>` |
| Need an element not yet in project UI folder | Run `npm install @radix-ui/react-<primitive>` and write the canonical shadcn component into `ui/` |

## Execution Steps

1. **Check existing UI components**: Inspect `@/shared/components/ui/` to see available primitives (`button`, `badge`, `select`, `switch`, `dialog`, `popover`, `progress`, `input`, `card`, `table`).
2. **Install missing Radix primitive**: If the required component is absent, install its `@radix-ui/react-*` package with `npm install`.
3. **Scaffold canonical component**: Create `{name}.tsx` in `@/shared/components/ui/` following official Radix + Tailwind `cn()` patterns.
4. **Refactor views**: Replace all inline raw HTML tags with the imported shadcn components.
5. **Verify**: Run `npm run build` to ensure TypeScript compliance and zero build warnings.

## Output Contract

Return:
- UI components created or refactored.
- Primitives installed or updated.
- Verification status (TypeScript build and visual alignment).

## References

- Official shadcn/ui documentation: `https://ui.shadcn.com`
- Radix UI Primitives: `https://www.radix-ui.com/primitives`
