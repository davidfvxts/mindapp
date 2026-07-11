/**
 * Settings — one quiet page, reachable from the Vault, never a fifth tab.
 * Four doors, each its own flow: the rhythm (cue, reminder, morning note,
 * tone, backup), what Coach knows (the full re-tune, which also holds the
 * erase-everything path), the account (log in to reach a backup from
 * anywhere), and the method. One job per page throughout.
 */
export function Settings({
  accountLabel, onRhythm, onRetune, onAccount, onMethod, onBack,
}: {
  accountLabel: string
  onRhythm: () => void
  onRetune: () => void
  onAccount: () => void
  onMethod: () => void
  onBack: () => void
}) {
  return (
    <div className="develop">
      <button className="btn text back-line" onClick={onBack}>← The Vault</button>
      <h1>Settings</h1>

      <div className="section">
        <button className="door" onClick={onRhythm}>
          The rhythm
          <span className="door-meta">Your cue, the nightly reminder, the morning note, Coach’s tone, backup.</span>
        </button>
        <button className="door" onClick={onRetune}>
          What Coach knows
          <span className="door-meta">Your name, your aim, your world — re-tune it any time. Erasing everything lives here too.</span>
        </button>
        <button className="door" onClick={onAccount}>
          Account
          <span className="door-meta">{accountLabel}</span>
        </button>
        <button className="door" onClick={onMethod}>
          The method
          <span className="door-meta">The five findings this runs on, and where your words live.</span>
        </button>
      </div>
    </div>
  )
}
