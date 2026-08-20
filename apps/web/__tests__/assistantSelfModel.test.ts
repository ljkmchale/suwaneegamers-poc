import { describe, expect, it } from "vitest";
import { publicSelfModel, adminSelfModel } from "@/lib/assistantSelfModel";

const doc = [
  "# Myra — Self-Model",
  "",
  "## Who I am",
  "I'm Myra, the voice guide.",
  "",
  "<!-- ADMIN:BEGIN — operational detail below is for verified admins only -->",
  "## Systems detail (admin)",
  "- Speech-to-text: Parakeet on the GPU is primary.",
  "<!-- ADMIN:END -->",
].join("\n");

describe("self-model tiering", () => {
  it("public part excludes the admin systems detail", () => {
    const pub = publicSelfModel(doc);
    expect(pub).toContain("I'm Myra, the voice guide.");
    expect(pub).not.toContain("Parakeet");
    expect(pub).not.toContain("Systems detail");
    expect(pub).not.toContain("ADMIN:BEGIN");
  });

  it("admin part is only the marked systems detail", () => {
    const admin = adminSelfModel(doc);
    expect(admin).toContain("Parakeet on the GPU is primary");
    expect(admin).not.toContain("voice guide");
  });

  it("a doc with no admin block yields the whole thing publicly and no admin part", () => {
    const plain = "# Myra\n\nI'm a voice assistant.";
    expect(publicSelfModel(plain)).toContain("voice assistant");
    expect(adminSelfModel(plain)).toBe("");
  });
});
