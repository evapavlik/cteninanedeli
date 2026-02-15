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
    const { container } = render(
      <ReadingContext readings={mockReadings} open={true} onOpenChange={() => {}} />
    );
    const aiText = container.querySelector('p');
    const allText = container.textContent || '';
    expect(allText).toContain("Vygenerováno pomocí AI");
  });
});
