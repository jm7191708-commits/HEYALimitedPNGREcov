// Offers
function Offers() {
  const D = window.HEYA_DATA;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Offers</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>Live offers · <em>3 out</em>, 84% accept rate QTD</h1>
          <p className="page-sub">Compensation, equity, and counter-offer signal. Approvals required before send.</p>
        </div>
        <div className="cluster">
          <button className="btn"><I.Filter /> All teams</button>
          <button className="btn primary"><I.Plus /> Draft offer</button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <StatCard label="Offers Out" value="3" delta="" tone="flat" />
        <StatCard label="Accept Rate (QTD)" value="84" unit="%" delta="+3pp" tone="up" />
        <StatCard label="Median Offer" value="$235k" delta="" tone="flat" />
        <StatCard label="Median Counter" value="+9%" delta="" tone="flat" />
      </div>

      {D.offers.map((o, i) => (
        <div key={i} className="offer-card">
          <div>
            <div className="cluster">
              <div className={"avatar " + ["tone-a","tone-b","tone-c"][i]}>{D.init(o.name)}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{o.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{o.role}</div>
              </div>
              {o.status === "sent" && <span className="tag orange">Sent · awaiting</span>}
              {o.status === "negotiating" && <span className="tag gold">Negotiating</span>}
              {o.status === "accepted" && <span className="tag green dot">Accepted</span>}
            </div>
            <div className="grid cols-4" style={{ marginTop: 14, gap: 14 }}>
              <div>
                <div className="mono muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Base + equity</div>
                <div className="amt">{o.amount}</div>
              </div>
              <div>
                <div className="mono muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Sent</div>
                <div style={{ marginTop: 4, fontWeight: 500 }}>{o.sent}</div>
              </div>
              <div>
                <div className="mono muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Expires</div>
                <div style={{ marginTop: 4, fontWeight: 500 }}>{o.expires}</div>
              </div>
              <div>
                <div className="mono muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Approved by</div>
                <div className="cluster" style={{ marginTop: 4 }}>
                  <div className="avatar sm tone-c">JT</div>
                  <div className="avatar sm tone-a">MK</div>
                  <div className="avatar sm tone-d">+1</div>
                </div>
              </div>
            </div>
          </div>
          <div className="stack" style={{ alignItems: "flex-end", gap: 6 }}>
            <button className="btn sm" style={{ width: "100%", justifyContent: "center" }}>View letter</button>
            {o.status === "negotiating" && <button className="btn sm primary" style={{ width: "100%", justifyContent: "center" }}>Counter</button>}
            {o.status === "sent" && <button className="btn sm" style={{ width: "100%", justifyContent: "center" }}>Send reminder</button>}
            {o.status === "accepted" && <button className="btn sm" style={{ width: "100%", justifyContent: "center" }}>Open onboarding</button>}
            <div className="mono muted" style={{ fontSize: 10, marginTop: 4 }}>Last update 2h ago</div>
          </div>
        </div>
      ))}
    </div>
  );
}

window.Offers = Offers;
