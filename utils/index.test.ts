import { formatDate, formatSessionSubtitle } from "./index";

describe("formatDate", () => {
  it('formats date as "MMM D, YYYY"', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(formatDate(date)).toBe("Jan 15, 2024");
  });

  it("formats different months correctly", () => {
    const date = new Date(2023, 11, 25); // Dec 25, 2023
    expect(formatDate(date)).toBe("Dec 25, 2023");
  });
});

describe("formatSessionSubtitle", () => {
  it("returns time for same day", () => {
    const now = new Date(2024, 0, 15, 14, 0);
    const created = new Date(2024, 0, 15, 10, 30);
    const lastModified = new Date(2024, 0, 15, 10, 30);

    const result = formatSessionSubtitle({
      now,
      created,
      lastModified,
      modifiedPrefix: "Modified",
    });

    expect(result).toMatch(/10:30\s*AM/);
  });

  it("returns weekday for same week", () => {
    // Jan 17 (Wed) and Jan 15 (Mon) are the same Mon-Sun week
    const now = new Date(2024, 0, 17); // Wednesday
    const created = new Date(2024, 0, 15, 9, 0); // Monday
    const lastModified = new Date(2024, 0, 15, 9, 0);

    const result = formatSessionSubtitle({
      now,
      created,
      lastModified,
      modifiedPrefix: "Modified",
    });

    expect(result).toBe("Monday");
  });

  it('returns "MMM D" for same year but different week', () => {
    const now = new Date(2024, 5, 15); // Jun 15
    const created = new Date(2024, 0, 15, 9, 0); // Jan 15
    const lastModified = new Date(2024, 0, 15, 9, 0);

    const result = formatSessionSubtitle({
      now,
      created,
      lastModified,
      modifiedPrefix: "Modified",
    });

    expect(result).toBe("Jan 15");
  });

  it('returns "MMM D, YYYY" for different year', () => {
    const now = new Date(2025, 5, 15);
    const created = new Date(2023, 11, 25, 9, 0);
    const lastModified = new Date(2023, 11, 25, 9, 0);

    const result = formatSessionSubtitle({
      now,
      created,
      lastModified,
      modifiedPrefix: "Modified",
    });

    expect(result).toBe("Dec 25, 2023");
  });

  it("shows modified prefix when lastModified - created > 1000ms", () => {
    const now = new Date(2024, 5, 15);
    const created = new Date(2024, 0, 15, 9, 0, 0);
    const lastModified = new Date(2024, 0, 15, 9, 0, 2); // 2s later

    const result = formatSessionSubtitle({
      now,
      created,
      lastModified,
      modifiedPrefix: "Modified",
    });

    expect(result).toMatch(/^Modified /);
    expect(result).toContain("Jan 15");
  });

  it("omits modified prefix when lastModified - created <= 1000ms", () => {
    const now = new Date(2024, 5, 15);
    const created = new Date(2024, 0, 15, 9, 0, 0, 0);
    const lastModified = new Date(2024, 0, 15, 9, 0, 0, 500); // 500ms later

    const result = formatSessionSubtitle({
      now,
      created,
      lastModified,
      modifiedPrefix: "Modified",
    });

    expect(result).not.toMatch(/^Modified /);
  });
});
