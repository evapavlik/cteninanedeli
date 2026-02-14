import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import React from "react";

interface AnnotatedTextProps {
  markdown: string;
  fontSize: number;
  lineHeight: number;
}

/**
 * Renders markdown with delivery annotations:
 * [pauza] → visual short pause marker
 * [dlouhá pauza] → visual long pause marker
 * [pomalu] → slow tempo indicator
 * [normálně] → normal tempo indicator
 */
function processAnnotations(text: string): React.ReactNode[] {
  const parts = text.split(
    /(\[pauza\]|\[dlouhá pauza\]|\[pomalu\]|\[normálně\])/g
  );

  return parts.map((part, i) => {
    switch (part) {
      case "[pauza]":
        return (
          <span
            key={i}
            className="inline-block mx-1 text-xs font-sans font-medium text-amber-600 dark:text-amber-400 align-super opacity-80"
            title="Krátká pauza (1s)"
          >
            ‖
          </span>
        );
      case "[dlouhá pauza]":
        return (
          <span
            key={i}
            className="inline-block mx-1.5 text-xs font-sans font-medium text-red-600 dark:text-red-400 align-super opacity-80"
            title="Dlouhá pauza (2-3s)"
          >
            ‖‖
          </span>
        );
      case "[pomalu]":
        return (
          <span
            key={i}
            className="inline-block mx-1 text-[0.65rem] font-sans font-semibold text-blue-600 dark:text-blue-400 align-super opacity-75"
            title="Číst pomalu"
          >
            ▼
          </span>
        );
      case "[normálně]":
        return (
          <span
            key={i}
            className="inline-block mx-1 text-[0.65rem] font-sans font-semibold text-green-600 dark:text-green-400 align-super opacity-75"
            title="Normální tempo"
          >
            ▲
          </span>
        );
      default:
        return <React.Fragment key={i}>{part}</React.Fragment>;
    }
  });
}

export function AnnotatedText({
  markdown,
  fontSize,
  lineHeight,
}: AnnotatedTextProps) {
  const hasAnnotations = /\[(pauza|dlouhá pauza|pomalu|normálně)\]/.test(
    markdown
  );

  return (
    <article
      className="prose-reading"
      style={{ fontSize: `${fontSize}px`, lineHeight }}
    >
      {hasAnnotations ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => {
              const processed = React.Children.map(children, (child) => {
                if (typeof child === "string") {
                  return processAnnotations(child);
                }
                return child;
              });
              return <p>{processed}</p>;
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      )}
    </article>
  );
}
