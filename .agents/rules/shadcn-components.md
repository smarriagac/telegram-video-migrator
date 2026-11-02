---
title: "MANDATORY: Always Use shadcn/ui Components"
trigger: "always_on"
description: "Enforces that all frontend UI development MUST strictly use shadcn/ui components from @/shared/components/ui/."
---

# Regla General de UI: Componentes shadcn/ui Obligatorios

En este proyecto está **estrictamente prohibido** maquetar elementos interactivos o de interfaz con HTML crudo o estilos ad-hoc cuando exista o deba existir un componente de **shadcn/ui**.

## Componentes Disponibles en `@/shared/components/ui/`

- **Botones**: Usar `<Button variant="..." size="...">` de `@/shared/components/ui/button`.
- **Badges / Chips**: Usar `<Badge variant="...">` de `@/shared/components/ui/badge`.
- **Inputs**: Usar `<Input ...>` de `@/shared/components/ui/input`.
- **Cards**: Usar `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardContent>`, `<CardFooter>` de `@/shared/components/ui/card`.
- **Selects / Menús desplegables**: Usar `<Select>`, `<SelectTrigger>`, `<SelectValue>`, `<SelectContent>`, `<SelectItem>` de `@/shared/components/ui/select` (basado en Radix UI).
- **Switches / Toggles**: Usar `<Switch checked={...} onCheckedChange={...}>` de `@/shared/components/ui/switch` (basado en Radix UI).
- **Diálogos / Modales**: Usar `<Dialog>`, `<DialogTrigger>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>` de `@/shared/components/ui/dialog`.
- **Popovers**: Usar `<Popover>`, `<PopoverTrigger>`, `<PopoverContent>` de `@/shared/components/ui/popover`.
- **Barras de Progreso**: Usar `<Progress value={...}>` de `@/shared/components/ui/progress`.
- **Tablas**: Usar `<Table>`, `<TableHeader>`, `<TableBody>`, `<TableRow>`, `<TableHead>`, `<TableCell>` de `@/shared/components/ui/table`.

## Directivas Obligatorias

1. **Nunca usar `<button>` sin estilizar o divs clickeables**: Usar siempre `<Button variant="default | primary | outline | secondary | ghost | destructive">`.
2. **Nunca usar `<select>` nativo**: Utilizar siempre la familia `<Select>` de Radix/shadcn para mantener la estética cyber-dark y comportamiento accesible.
3. **Nunca armar switches con botones o checkbox crudos**: Utilizar siempre `<Switch>`.
4. **Nunca usar `<input>` crudo para inputs de texto o búsqueda**: Usar `<Input>` de `@/shared/components/ui/input`.
5. **Nunca usar tags `<span>` arbitrarios para estados**: Usar `<Badge>` con sus variantes semánticas.
6. **Instalación de nuevos componentes**: Si se requiere un componente que aún no existe en `@/shared/components/ui/` (por ejemplo `Tooltip`, `DropdownMenu`, `Tabs`, `Slider`, `Accordion`), se debe instalar la primitiva de `@radix-ui` correspondiente y registrar el componente canónico en `@/shared/components/ui/` en lugar de programar una solución improvisada.
