# Technical Design: accessible-shadcn-ui

## 1. Component Architecture

We will introduce accessible shadcn UI primitives under `frontend/src/shared/components/ui/`:
```text
frontend/src/shared/components/ui/
├── dialog.tsx     # Radix Dialog wrapper with dark Tailwind theme
├── select.tsx     # Radix Select wrapper with custom dropdown styling
├── progress.tsx   # Radix Progress wrapper with glowing emerald track
└── button.tsx     # CVA-styled accessible button with Slot composition
```

These primitives are then consumed by the feature presentation components in `frontend/src/features/migration/presentation/components/`:
- `ConfirmModal.tsx` -> replaces manual overlay with `<Dialog open={...} onOpenChange={...}>`
- `ChannelSelector.tsx` -> replaces `<select>` with `<Select value={...} onValueChange={...}>`
- `ProgressBar.tsx` -> replaces manual div track with `<Progress value={percentage} />`
- `TerminalLog.tsx` -> adds `aria-live="polite"` region

## 2. Dependencies
- `@radix-ui/react-dialog`
- `@radix-ui/react-select`
- `@radix-ui/react-progress`
- `@radix-ui/react-slot`
- `class-variance-authority`

## 3. Preservation of Architectural Constraints
In `MigrationView.tsx`:
- `const [isConfirmOpen, setIsConfirmOpen] = useState(false);`
- `const [searchFilter, setSearchFilter] = useState("");`
Strictly exactly two `useState` hooks remain in `MigrationView`.
