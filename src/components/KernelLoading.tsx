// ─── KernelLoading ──────────────────────────────────────
//
// "Ink Constellation" — Kernel's original loading animation.
// Three amethyst ink drops materialize on ivory paper, breathe
// in organic rhythm, and drift gently. Faint threads connect
// them like a constellation forming from scattered marks.

interface KernelLoadingProps {
  /** Show the logo above the constellation */
  showLogo?: boolean
}

export function KernelLoading({ showLogo = false }: KernelLoadingProps) {
  return (
    <div className="ka-loading-splash">
      {showLogo && (
        <img
          className="ka-loading-logo"
          src={`${import.meta.env.BASE_URL}logo-mark.svg`}
          alt="Kernel"
        />
      )}
      <div className="ka-loading-constellation" aria-label="Loading" role="status">
        {/* Three ink drops */}
        <span className="ka-loading-drop" />
        <span className="ka-loading-drop" />
        <span className="ka-loading-drop" />
        {/* Connecting threads */}
        <span className="ka-loading-thread" />
        <span className="ka-loading-thread" />
        <span className="ka-loading-thread" />
      </div>
    </div>
  )
}
