import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { ReadingContext, type ReadingContextEntry } from "@/components/ReadingContext";

const mockReadings: ReadingContextEntry[] = [
  {
    title: "Ex 24,12-18",
    intro: "Test intro",
    characters: [{ name: "Mojžíš", description: "Vůdce" }],
    historical_context: "Po exodu",
    main_message: "Smlouva",
    tone: "slavnostní",
  },
];

describe("AI labels", () => {
  it("ReadingContext shows AI disclaimer", () => {
    render(
      <ReadingContext readings={mockReadings} open={true} onOpenChange={() => {}} />
    );
    // Sheet renders into a portal, so check document.body
    const allText = document.body.textContent || '';
    expect(allText).toContain("Vygenerováno pomocí AI");
  });
});
