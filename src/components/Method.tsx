/**
 * The method — the evidence and the privacy contract, on its own page.
 * Reachable from the welcome (before trusting us with a word) and from
 * Settings (any time after). One page, five findings, one promise.
 */
export function Method({ onBack }: { onBack: () => void }) {
  return (
    <div className="develop">
      <button className="btn text back-line" onClick={onBack}>← Back</button>
      <h1>The method</h1>
      <p className="sub">
        Five minutes a night, built on findings that held up. Coach works from these — nothing else.
      </p>
      <div className="section">
        <div className="item">
          <div className="item-meta ambient">Name the moment, in writing</div>
          <div className="item-body">Putting a hard moment into words cools it. — Pennebaker, expressive writing</div>
        </div>
        <div className="item">
          <div className="item-meta ambient">Step back to see it</div>
          <div className="item-body">Distanced self-talk turns rumination into perspective. — Kross, Chatter</div>
        </div>
        <div className="item">
          <div className="item-meta ambient">Ask what, not why</div>
          <div className="item-body">What-questions build accurate self-insight; why-questions spiral. — Eurich, Insight</div>
        </div>
        <div className="item">
          <div className="item-meta ambient">One next step, if-then</div>
          <div className="item-body">Naming when and where you’ll act markedly raises follow-through. — Gollwitzer, implementation intentions</div>
        </div>
        <div className="item">
          <div className="item-meta ambient">Debrief against the goal</div>
          <div className="item-body">Reviewing the day against a declared aim is how teams — and people — compound. — Locke &amp; Latham; after-action reviews</div>
        </div>
      </div>
      <div className="section">
        <span className="ambient">Your words</span>
        <p className="secondary" style={{ marginTop: 'var(--s-3)' }}>
          No account. No email. Your words stay on this phone unless you choose backup.
          Coach reads a night only to reply to it — nothing you write is used for anything else, ever.
          Facet counts which screens get used — a nameless tally, never a word of what you write.
        </p>
      </div>
    </div>
  )
}
