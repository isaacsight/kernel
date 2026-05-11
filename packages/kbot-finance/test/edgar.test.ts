import { describe, expect, it } from "vitest";
import { padCik, normalizeRecentFilings, type EdgarSubmissionsResponse } from "../src/adapters/edgar/index.js";

describe("EDGAR adapter", () => {
  it("pads CIK to 10 digits", () => {
    expect(padCik("320193")).toBe("0000320193");
    expect(padCik(320193)).toBe("0000320193");
    expect(padCik("CIK0000320193")).toBe("0000320193");
    expect(padCik("0000320193")).toBe("0000320193");
  });

  it("normalizes column-oriented recent filings into rows", () => {
    const response: EdgarSubmissionsResponse = {
      name: "APPLE INC",
      filings: {
        recent: {
          accessionNumber: ["0000320193-25-000010", "0000320193-25-000011"],
          filingDate: ["2025-01-15", "2025-02-20"],
          reportDate: ["2024-12-31", "2025-01-31"],
          form: ["10-K", "10-Q"],
          primaryDocument: ["aapl-2024.htm", "aapl-2025q1.htm"],
          primaryDocDescription: ["Annual report", "Quarterly report"],
          size: [1000000, 500000],
          isXBRL: [1, 1],
        },
      },
    };
    const rows = normalizeRecentFilings(response, "320193", 10);
    expect(rows.length).toBe(2);
    expect(rows[0]?.accession_number).toBe("0000320193-25-000010");
    expect(rows[0]?.form).toBe("10-K");
    expect(rows[0]?.is_xbrl).toBe(true);
    expect(rows[0]?.archive_url).toContain("320193");
    expect(rows[0]?.archive_url).toContain("000032019325000010");
  });

  it("respects the limit parameter", () => {
    const response: EdgarSubmissionsResponse = {
      filings: {
        recent: {
          accessionNumber: Array.from({ length: 100 }, (_, i) => `0000-${i}`),
          filingDate: Array.from({ length: 100 }, () => "2025-01-01"),
          form: Array.from({ length: 100 }, () => "10-K"),
        },
      },
    };
    const rows = normalizeRecentFilings(response, "320193", 5);
    expect(rows.length).toBe(5);
  });

  it("returns empty array when no filings present", () => {
    const rows = normalizeRecentFilings({}, "320193", 10);
    expect(rows).toEqual([]);
  });
});
