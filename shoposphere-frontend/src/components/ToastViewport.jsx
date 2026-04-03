import { useToast } from "../context/ToastContext";

function typeStyles(type) {
  switch (type) {
    case "success":
      return {
        className: "app-toast--success",
        label: "Success",
      };
    case "error":
      return {
        className: "app-toast--error",
        label: "Error",
      };
    case "warning":
      return {
        className: "app-toast--warning",
        label: "Warning",
      };
    default:
      return {
        className: "app-toast--info",
        label: "Info",
      };
  }
}

function ToastIcon({ type }) {
  if (type === "success") {
    return (
      <svg className="app-toast__icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M20 7L10 17l-6-6" />
      </svg>
    );
  }

  if (type === "error") {
    return (
      <svg className="app-toast__icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 9v4m0 4h.01" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    );
  }

  if (type === "warning") {
    return (
      <svg className="app-toast__icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 8v4m0 4h.01" />
        <circle cx="12" cy="12" r="9" strokeWidth="2.2" />
      </svg>
    );
  }

  return (
    <svg className="app-toast__icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeWidth="2.2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 10v5m0-8h.01" />
    </svg>
  );
}

export default function ToastViewport() {
  const { toasts, remove } = useToast();
  if (!toasts.length) return null;

  return (
    <div className="app-toast-stack" role="region" aria-label="Notifications">
      {toasts.map((t, index) => {
        const s = typeStyles(t.type);
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={["app-toast", s.className].join(" ")}
            style={{ animationDelay: `${Math.min(index * 50, 180)}ms` }}
          >
            <div className="app-toast__glow" aria-hidden="true" />
            <div className="app-toast__content">
              <div className="app-toast__icon-wrap">
                <ToastIcon type={t.type} />
              </div>

              <div className="app-toast__text-wrap">
                <p className="app-toast__message">{t.message}</p>
              </div>

              <button
                type="button"
                onClick={() => remove(t.id)}
                className="app-toast__close"
                aria-label="Dismiss notification"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

