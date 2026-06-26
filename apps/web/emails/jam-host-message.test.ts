import { describe, it, expect } from "vitest";
import { jamHostMessageHtml } from "./jam-host-message";

const base = {
  hostName: "Ben",
  jamName: "Thursday Night Jam",
  jamUrl: "https://singjam.org/jam/1",
  subject: "Heads up about parking",
  body: "Hey everyone, parking is tight on Thursday.",
};

describe("jamHostMessageHtml", () => {
  it("renders the subject in the heading", () => {
    const html = jamHostMessageHtml(base);
    expect(html).toContain("Heads up about parking");
  });

  it("renders host name and jam name in the header line", () => {
    const html = jamHostMessageHtml(base);
    expect(html).toContain("Ben");
    expect(html).toContain("Thursday Night Jam");
  });

  it("greets recipient by name when provided", () => {
    const html = jamHostMessageHtml({ ...base, recipientName: "Alice" });
    expect(html).toContain("Hi Alice,");
  });

  it("uses generic greeting when recipient name is omitted", () => {
    const html = jamHostMessageHtml({ ...base, recipientName: null });
    expect(html).toContain("Hi,");
  });

  it("converts newlines in body to <br>", () => {
    const html = jamHostMessageHtml({ ...base, body: "Line one\nLine two" });
    expect(html).toContain("Line one<br>Line two");
  });

  it("includes the jam URL", () => {
    const html = jamHostMessageHtml(base);
    expect(html).toContain("https://singjam.org/jam/1");
  });
});
