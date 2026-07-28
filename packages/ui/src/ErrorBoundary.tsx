import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly onError?: (error: unknown, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="fatal-error" id="main-content">
          <div className="fatal-error-card" role="alert">
            <span aria-hidden="true" className="brand-mark">
              N
            </span>
            <h1>Nexora non è riuscita ad avviarsi</h1>
            <p>I dati locali non sono stati modificati. Ricarica l’applicazione per riprovare.</p>
            <button
              className="primary-button"
              onClick={() => {
                window.location.reload();
              }}
              type="button"
            >
              Ricarica applicazione
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
