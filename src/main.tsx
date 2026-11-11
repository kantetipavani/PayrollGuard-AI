import React, { Component, ErrorInfo, ReactNode } from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#F5F6F7",
            fontFamily: "'Inter', Arial, sans-serif",
            padding: 24,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #D9D9D9",
              borderRadius: 8,
              padding: "32px 36px",
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#FFEBEB",
                color: "#BB0000",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              !
            </div>
            <h2
              style={{
                margin: "0 0 8px",
                fontSize: 18,
                fontWeight: 800,
                color: "#32363A",
              }}
            >
              Application Error
            </h2>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6A6D70" }}>
              An unexpected error occurred while rendering the interface.
            </p>
            {this.state.error && (
              <pre style={{
                textAlign: "left",
                background: "#FEE2E2",
                color: "#991B1B",
                padding: "10px 12px",
                borderRadius: 6,
                fontSize: 11,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                marginBottom: 16,
                maxHeight: 150,
              }}>
                {this.state.error.message || String(this.state.error)}
                {"\n"}
                {this.state.error.stack?.split("\n").slice(0, 4).join("\n")}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#0070F2",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 6,
                padding: "9px 20px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reload Workspace
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

