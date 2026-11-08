// Sidebar nav with personalized account identity from settings.
function Sidebar({ view, setView, counts, settings }) {
  const items = [
    { id: "dashboard", label: "Dashboard", Icon: I.Home },
    { id: "employers", label: "Employers", Icon: I.Building, count: counts.employers },
    { id: "requisitions", label: "Requisitions", Icon: I.Check, count: counts.requisitions },
    { id: "positions", label: "Positions", Icon: I.Briefcase, count: counts.positions },
    { id: "applicants", label: "Applicants", Icon: I.Users, count: counts.applicants, childOf: "positions" },
    { id: "screening", label: "Screening", Icon: I.Bot, count: counts.screening },
    { id: "shortlist", label: "Shortlist", Icon: I.Pin, count: counts.shortlist },
    { id: "interviews", label: "Interviews", Icon: I.Calendar, count: counts.interviews, childOf: "positions" },
    { id: "offers", label: "Offers", Icon: I.Mail, count: counts.offers, childOf: "positions" },
    { id: "talent", label: "Talent Pool", Icon: I.Pipeline },
    { id: "reports", label: "Reports", Icon: I.Activity },
  ];

  const accountSettings = settings?.accountSettings || {};
  const profile = settings?.profile || {};
  const displayName = accountSettings.fullName || profile.displayName || profile.username || "Dashboard Admin";
  const username = profile.username || (accountSettings.email ? accountSettings.email.split("@")[0] : "dashboard-admin");
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "DA";

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">H</div>
        <div>
          <div className="brand-name">HEYA<em>/</em>desk</div>
          <div className="brand-sub">Talent Solutions</div>
        </div>
      </div>

      <div className="nav-section">Workspace</div>
      {items.map((it) => (
        <div key={it.id} className={"nav-item" + (view === it.id ? " active" : "") + (it.childOf ? " nav-item-child" : "")} onClick={() => setView(it.id)}>
          <it.Icon className="nav-icon" />
          <span>{it.label}</span>
          {it.count != null && <span className="count">{it.count}</span>}
        </div>
      ))}

      <div className="sidebar-foot">
        <div className={"nav-item" + (view === "settings" ? " active" : "")} onClick={() => setView("settings")}>
          <I.Settings className="nav-icon" />
          <span>Accounts</span>
        </div>
        <div className="sidebar-account">
          <div className="avatar tone-c sidebar-account__avatar">
            {(accountSettings.avatarUrl || profile.avatarUrl) ? <img src={accountSettings.avatarUrl || profile.avatarUrl} alt={displayName} /> : initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-account__name">{displayName}</div>
            <div className="mono sidebar-account__meta">@{username}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
