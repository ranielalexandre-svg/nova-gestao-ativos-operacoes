import { parseCsv, toCsv } from "./csv";

describe("csv helpers", () => {
  it("neutralizes spreadsheet formulas on export", () => {
    const csv = toCsv(
      [
        { code: "=cmd", name: "+sum", isActive: "-1" },
        { code: "@link", name: "normal", isActive: true },
      ],
      ["code", "name", "isActive"],
    );

    expect(csv).toContain("'=cmd");
    expect(csv).toContain("'+sum");
    expect(csv).toContain("'-1");
    expect(csv).toContain("'@link");
  });

  it("parses quoted csv values", () => {
    expect(parseCsv('code,name\nA,"Nome, com virgula"')).toEqual([
      { code: "A", name: "Nome, com virgula" },
    ]);
  });
});
