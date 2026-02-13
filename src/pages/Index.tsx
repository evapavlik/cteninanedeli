import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { fetchCyklus } from "@/lib/api/firecrawl";
import { Loader2, BookOpen } from "lucide-react";

const Index = () => {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    const result = await fetchCyklus();
    if (result.success && result.markdown) {
      setMarkdown(result.markdown);
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
      <div className="mx-auto max-w-2xl px-6 py-12 md:py-20">
        {/* Header */}
        <header className="mb-16 text-center">
          <BookOpen className="mx-auto mb-6 h-10 w-10 text-foreground/60" strokeWidth={1} />
          <h1 className="mb-3 font-serif text-3xl font-light tracking-tight text-foreground md:text-4xl">
            Nedělní čtení
          </h1>
          <p className="font-serif text-lg text-muted-foreground italic">
            Kazatelský cyklus CČSH
          </p>
          <p className="mt-4 text-sm text-muted-foreground capitalize">
            {formattedDate}
          </p>
        </header>

        {/* Content */}
        {!markdown && !loading && (
          <div className="text-center">
            <Button
              onClick={handleFetch}
              variant="outline"
              className="h-14 rounded-none border-foreground px-10 font-serif text-base tracking-wide text-foreground hover:bg-foreground hover:text-background"
            >
              Načíst nedělní čtení
            </Button>
            {error && (
              <p className="mt-6 font-serif text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-4 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-foreground/40" />
            <p className="font-serif text-sm text-muted-foreground">
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
