import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore } from "../useThemeStore";

describe("useThemeStore", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    useThemeStore.setState({ theme: "dark" });
  });

  it("toggles theme between dark and light", () => {
    expect(useThemeStore.getState().theme).toBe("dark");

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("light");
    expect(localStorage.getItem("telegram_hub_theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("dark");
    expect(localStorage.getItem("telegram_hub_theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("sets specific theme directly", () => {
    useThemeStore.getState().setTheme("light");
    expect(useThemeStore.getState().theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");

    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});
