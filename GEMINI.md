# Project Rules & Guidelines

## Frontend Architecture & UI Standards

### 1. Mandatory shadcn/ui Components
All UI development must strictly use official **shadcn/ui** components located in `@/shared/components/ui/`:
- **Buttons**: `<Button variant="..." size="...">` (`@/shared/components/ui/button`)
- **Badges**: `<Badge variant="...">` (`@/shared/components/ui/badge`)
- **Inputs**: `<Input ...>` (`@/shared/components/ui/input`)
- **Cards**: `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardContent>`, `<CardFooter>` (`@/shared/components/ui/card`)
- **Selects**: `<Select>`, `<SelectTrigger>`, `<SelectValue>`, `<SelectContent>`, `<SelectItem>` (`@/shared/components/ui/select`)
- **Switches**: `<Switch checked={...} onCheckedChange={...}>` (`@/shared/components/ui/switch`)
- **Modals**: `<Dialog>`, `<DialogContent>`, `<DialogHeader>`, etc. (`@/shared/components/ui/dialog`)
- **Popovers**: `<Popover>`, `<PopoverTrigger>`, `<PopoverContent>` (`@/shared/components/ui/popover`)
- **Progress**: `<Progress value={...}>` (`@/shared/components/ui/progress`)
- **Tables**: `<Table>`, `<TableHeader>`, `<TableBody>`, `<TableRow>`, `<TableHead>`, `<TableCell>` (`@/shared/components/ui/table`)

**Strictly prohibited**:
- Never use native `<select>` or raw unstyled `<button>` elements.
- Never use raw `<input>` for text or search without wrapping or using `<Input>`.
- Never hand-code toggles or switches with custom `<button>` + `translate-x` spans.
- Never use ad-hoc `<span>` tags for event/status chips when `<Badge>` can be used.
- If a new component is needed (e.g. `Tooltip`, `DropdownMenu`), install the Radix primitive and create the shadcn component in `@/shared/components/ui/`.

### 2. State & Hook Budgets
- View components must maintain at most **2 `useState` hooks**. Complex state belongs to Zustand stores or dedicated custom hooks.

### 3. Craft & Aesthetics
- Dark cyber aesthetic (#090A0F, #0E1015, #14161F) with emerald, cyan, and sky accents.
- Zero craft anti-patterns (`npx -y impeccable detect frontend/src`).
