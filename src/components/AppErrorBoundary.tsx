import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Card } from "./ui";

type State = { errorId: string | null };

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { errorId: null };

  static getDerivedStateFromError(): State {
    return { errorId: crypto.randomUUID() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Jangan mengirim token, session, atau data formulir ke log.
    console.error("Application error", {
      id: this.state.errorId,
      name: error.name,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (!this.state.errorId) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <Card className="max-w-lg text-center">
          <h1 className="text-xl font-bold text-white">
            Aplikasi mengalami kendala
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Muat ulang halaman untuk mencoba kembali. ID kendala:{" "}
            <code>{this.state.errorId}</code>
          </p>
          <Button className="mt-5" onClick={() => location.reload()}>
            Muat Ulang
          </Button>
        </Card>
      </main>
    );
  }
}
