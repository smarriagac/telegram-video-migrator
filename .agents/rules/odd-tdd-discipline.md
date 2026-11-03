---
title: "MANDATORY: ODD & TDD Engineering Discipline (Gentle AI Standard)"
trigger: "always_on"
description: "Enforces that all non-trivial engineering tasks, bugfixes, and features MUST strictly follow Organic Driven Development (ODD) documentation in odd/tasks/ and Test-Driven Development (TDD) with automated tests in backend/tests/ or frontend component tests."
---

# Regla General de Ingeniería: ODD y TDD Obligatorios (Gentle AI)

En este proyecto está **terminantemente prohibido** modificar código, corregir bugs o implementar features sin seguir la disciplina estricta de **Organic Driven Development (ODD)** y **Test-Driven Development (TDD)**.

## 1. ODD (Organic Driven Development)

Toda tarea técnica, fix de bug, módulo nuevo o refactor estructural DEBE estar documentado en `odd/tasks/<task-slug>.md` respetando la estructura canónica:

1. **Header & Context**:
   - `# Feature: <Nombre Claro del Feature o Fix>`
   - Resumen del objetivo y `Delivery strategy: single-pr`.
2. **Especificaciones (Specs)**:
   - `## Specs` desglosadas (`S1`, `S2`, `S3`...) definiendo arquitectura, contratos de datos, endpoints o componentes.
3. **Tareas Atómicas de Ejecución (Tasks)**:
   - `## Tasks` con formato `- [x] T1 (S1): ... [inline]` para tracking granular.
4. **Bitácora de Decisiones e Incidentes (Log)**:
   - `## Log` cronológico (`L1`, `L2`...) documentando causa raíz de bugs encontrados, decisiones arquitectónicas y evidencias de verificación.

## 2. TDD (Test-Driven Development)

Ninguna corrección de bug o feature se considera completada sin su prueba automatizada correspondiente:

1. **Bugfixes**: Antes o durante la corrección, escribir un test de regresión automatizado (en `backend/tests/` o tests de componentes frontend) que reproduzca la falla y asegure que no vuelva a ocurrir.
2. **Features Nuevos**: Cubrir entidades de dominio, casos de uso y endpoints con pruebas unitarias o de integración.
3. **Ejecución Obligatoria**: Correr la suite en el contenedor (`docker exec telegram_migrator_backend pytest backend/tests/`) y compilar el frontend (`npm run build`). No se entrega trabajo con tests rotos.

## 3. UI y Restricciones Arquitectónicas

1. **Zero Browser Alerts/Confirms**: Prohibido usar `window.confirm` o `window.alert`. Usar siempre el modal canónico `ConfirmDialog` (`@/shared/components/ui/confirm-dialog.tsx`).
2. **Presupuesto de Hooks**: Máximo **2 `useState` hooks** por componente de vista. El estado complejo pertenece a Zustand stores o custom hooks encapsulados.
3. **Componentes Canónicos**: Usar exclusivamente componentes de shadcn/ui (`@/shared/components/ui/`).
4. **Commits Convencionales**: Usar siempre formato conventional commits (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`), estrictamente SIN "Co-Authored-By" ni atribución a IA.
