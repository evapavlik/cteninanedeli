import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 font-serif text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 font-serif text-xl text-muted-foreground">Stránka nenalezena</p>
        <a href="/" className="font-serif text-primary underline hover:text-primary/90">
          Zpět na úvodní stránku
        </a>
      </div>
    </div>
  );
};

export default NotFound;
