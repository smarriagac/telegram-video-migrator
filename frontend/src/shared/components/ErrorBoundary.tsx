import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-6 text-center">
          <div className="max-w-md w-full bg-card border border-rose-500/30 rounded-md p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500 dark:text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Se produjo un error en la vista</h2>
              <p className="text-xs text-muted-foreground mt-1">
                La aplicación encontró un estado inesperado.
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 rounded-lg bg-secondary/60 border border-border text-left text-[11px] font-mono text-rose-500 dark:text-rose-400 max-h-36 overflow-y-auto break-words">
                {this.state.error.message}
              </div>
            )}
            <Button
              onClick={this.handleReload}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-8 text-xs flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Recargar Aplicación
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
