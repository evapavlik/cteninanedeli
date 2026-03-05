import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  /** If true, shows a compact inline fallback instead of full-page */
  inline?: boolean;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.inline) {
      return null;
    }

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-serif text-lg text-foreground">
          Něco se pokazilo.
        </p>
        <p className="font-serif text-sm text-muted-foreground">
          Zkuste stránku načíst znovu.
        </p>
        <button
          onClick={this.handleReload}
          className="rounded-full border border-border bg-card px-6 py-2.5 font-serif text-sm text-foreground transition-colors hover:bg-accent"
        >
          Zkusit znovu
        </button>
      </div>
    );
  }
}
