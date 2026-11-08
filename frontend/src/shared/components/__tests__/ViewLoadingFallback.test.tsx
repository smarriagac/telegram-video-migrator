import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ViewLoadingFallback } from "../ViewLoadingFallback";

describe("ViewLoadingFallback", () => {
  it("renders with role='status' and polite aria-live for accessibility", () => {
    render(<ViewLoadingFallback />);
    const statusRegion = screen.getByRole("status");
    expect(statusRegion).toBeInTheDocument();
    expect(statusRegion).toHaveAttribute("aria-live", "polite");
  });

  it("displays default message when none provided", () => {
    render(<ViewLoadingFallback />);
    expect(screen.getByText("Cargando módulo...")).toBeInTheDocument();
  });

  it("displays custom loading message when provided", () => {
    render(<ViewLoadingFallback message="Iniciando sesión segura..." />);
    expect(screen.getByText("Iniciando sesión segura...")).toBeInTheDocument();
  });
});
