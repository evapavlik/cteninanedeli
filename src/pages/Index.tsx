import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { fetchCyklus } from "@/lib/api/firecrawl";
import { Loader2, BookOpen } from "lucide-react";

const Index = () => {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [sundayTitle, setSundayTitle] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    const result = await fetchCyklus();
    if (result.success && result.markdown) {
      setMarkdown(result.markdown);
      setSundayTitle(result.sundayTitle || "");
    } else {
      setError(result.error || "Nepodařilo se načíst čtení.");
    }
    setLoading(false);
  };

  const today = new Date();
  const formattedDate = today.toLocaleDateString("cs-CZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-10 md:px-6 md:py-20">
        {/* Header */}
        <header className="mb-12 text-center md:mb-16">
          <BookOpen className="mx-auto mb-5 h-9 w-9 text-foreground/60 md:h-10 md:w-10" strokeWidth={1} />
          <h1 className="mb-2 font-serif text-3xl font-light tracking-tight text-foreground md:text-4xl">
            Nedělní čtení
          </h1>
          <p className="font-serif text-lg text-muted-foreground italic md:text-xl">
            Kazatelský cyklus CČSH
          </p>
          {sundayTitle && (
            <p className="mt-4 font-serif text-xl font-medium text-foreground md:text-2xl">
              {sundayTitle}
            </p>
          )}
          <p className="mt-3 text-base text-muted-foreground capitalize md:text-lg">
            {formattedDate}
          </p>
        </header>

        {/* Content */}
        {!markdown && !loading && (
          <div className="text-center">
            <Button
              onClick={handleFetch}
              variant="outline"
              className="h-16 rounded-none border-foreground px-10 font-serif text-lg tracking-wide text-foreground hover:bg-foreground hover:text-background md:h-14 md:text-base"
            >
              Načíst nedělní čtení
            </Button>
            {error && (
              <p className="mt-6 font-serif text-base text-destructive">{error}</p>
            )}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-4 py-16">
            <Loader2 className="h-7 w-7 animate-spin text-foreground/40" />
            <p className="font-serif text-base text-muted-foreground md:text-lg">
              Stahuji aktuální čtení…
            </p>
          </div>
        )}

        {markdown && (
          <article className="prose-reading">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </article>
        )}
      </div>
    </div>
  );
};

export default Index;
