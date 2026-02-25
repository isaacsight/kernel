/**
 * Ink Constellation loading screen.
 * 5 sepia dots connected by faint threads, gently drifting.
 * Optionally renders the logo mark above the constellation.
 */
export function KernelLoading({ showLogo = false }: { showLogo?: boolean }) {
  return (
    <div className="ka-loading-splash">
      {showLogo && (
        <img
          className="ka-loading-logo"
          src={`${import.meta.env.BASE_URL}logo-mark.svg`}
          alt="Kernel"
        />
      )}
      <div className="ka-loading-constellation" aria-hidden="true">
        {/* Thread lines forming a square */}
        <svg className="ka-loading-thread" viewBox="0 0 120 120">
          <line x1="30" y1="30" x2="90" y2="30" />
          <line x1="90" y1="30" x2="90" y2="90" />
          <line x1="90" y1="90" x2="30" y2="90" />
          <line x1="30" y1="90" x2="30" y2="30" />
        </svg>
        {/* Ink drops — four corners */}
        <span className="ka-loading-drop" />
        <span className="ka-loading-drop" />
        <span className="ka-loading-drop" />
        <span className="ka-loading-drop" />
      </div>
    </div>
  )
}
