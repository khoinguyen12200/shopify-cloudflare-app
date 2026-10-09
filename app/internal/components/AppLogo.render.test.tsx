import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { identity } from "~/identity";
import { AppLogo, AppMark } from "./AppLogo";

describe("AppLogo", () => {
  it("shows the product name from identity next to the mark", () => {
    const html = renderToStaticMarkup(<AppLogo />);
    expect(html).toContain(identity.brandName);
    expect(html).toContain("<svg");
  });

  it("hides the name, not the mark, when the sidebar is collapsed", () => {
    const html = renderToStaticMarkup(<AppLogo />);
    const name = html.slice(html.indexOf("<span", html.indexOf("</svg>")));
    expect(name).toContain("group-data-[collapsible=icon]:hidden");
  });

  it("draws with currentColor so it follows the theme, and is decorative to screen readers", () => {
    const html = renderToStaticMarkup(<AppMark />);
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain('aria-hidden="true"');
  });
});
