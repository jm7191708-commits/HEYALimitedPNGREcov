// Calendar — week view with interview events
function Calendar() {
  const D = window.HEYA_DATA;
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17];
  const days = ["Tue 14", "Wed 15", "Thu 16", "Fri 17", "Mon 20"];
  const slotHeight = 48;
  const startHour = 9;

  return (
    <div className="page" style={{ maxWidth: "none" }}>
      <div className="page-head">
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Schedule · May 14–20, 2026</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>Your interviewing <em>week</em></h1>
          <p className="page-sub">Phone screens, onsites, debriefs and offer calls — color-coded by stage.</p>
        </div>
        <div className="cluster">
          <div className="role-switch">
            <button className="role-pill">Day</button>
            <button className="role-pill active">Week</button>
            <button className="role-pill">Month</button>
          </div>
          <button className="btn">‹</button>
          <button className="btn">Today</button>
          <button className="btn">›</button>
          <button className="btn primary"><I.Plus /> Schedule</button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <StatCard label="Interviews this week" value="14" delta="+2 vs last" tone="up" />
        <StatCard label="Avg duration" value="48" unit="min" delta="" tone="flat" />
        <StatCard label="Cancellations" value="1" delta="−2" tone="up" />
        <StatCard label="Interviewer load" value="68" unit="%" delta="Balanced" tone="flat" />
      </div>

      <div className="cal-grid">
        <div className="cal-head">
          <div></div>
          {days.map((d, i) => {
            const parts = d.split(" ");
            return (
              <div key={d} className={i === 0 ? "today" : ""}>
                <div>{parts[0]}</div>
                <div className="day-num">{parts[1]}</div>
              </div>
            );
          })}
        </div>
        <div className="cal-times">
          {hours.map(h => (
            <React.Fragment key={h}>
              <div className="cal-time">{((h - 1) % 12) + 1}{h >= 12 ? "p" : "a"}</div>
              {days.map((_, di) => (
                <div key={di} className="cal-slot">
                  {D.calendar.filter(e => e.day === di && Math.floor(e.start) === h).map((e, ei) => {
                    const top = (e.start - h) * slotHeight;
                    const height = (e.end - e.start) * slotHeight - 4;
                    return (
                      <div key={ei} className={"cal-event " + (e.tone || "")} style={{ top: top + 2, height }}>
                        <div className="title" style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{e.title}</div>
                        <div className="who">{e.who} · {fmtTime(e.start)}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

window.Calendar = Calendar;
