import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { ReadingContext, type ReadingContextEntry } from "@/components/ReadingContext";

const mockReadings: ReadingContextEntry[] = [
  {
    title: "Ex 24,12-18",
    intro: "Test intro",
    context: "Mojžíš vystupuje na horu Sinaj, aby přijal Boží zákon.",
    delivery: "Čtěte slavnostně a s důrazem na Boží přítomnost.",
  },
];

describe("AI labels", () => {
  it("ReadingContext shows AI disclaimer", () => {
    const { container } = render(
      <ReadingContext readings={mockReadings} open={true} onOpenChange={() => {}} />
    );
    const allText = container.textContent || '';
    expect(allText).toContain("Vygenerováno pomocí AI");
  });
});
