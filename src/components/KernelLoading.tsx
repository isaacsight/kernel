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
        {/* Thread lines connecting the drops */}
        <svg className="ka-loading-thread" viewBox="0 0 120 120">
          <line x1="60" y1="24" x2="22" y2="54" />
          <line x1="60" y1="24" x2="98" y2="54" />
          <line x1="22" y1="54" x2="36" y2="86" />
          <line x1="98" y1="54" x2="84" y2="86" />
        </svg>
        {/* Ink drops */}
        <span className="ka-loading-drop" />
        <span className="ka-loading-drop" />
        <span className="ka-loading-drop" />
        <span className="ka-loading-drop" />
        <span className="ka-loading-drop" />
      </div>
    </div>
  )
}
