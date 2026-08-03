import nodemailer from "nodemailer";

// The 24/7 monitor detects when a critical service goes down or recovers. This
// module turns those transitions into an email so an outage reaches a human even
// when nobody is looking at /admin/myra-health. It is deliberately best-effort:
// a failed send must never break a health check, so callers fire-and-forget.

export interface IncidentTransition {
  kind: "opened" | "resolved";
  service: string;
  displayName: string;
  severity: "info" | "warning" | "critical";
  summary: string;
  technicalDetails?: string;
  userImpact?: string;
  startedAt: string;
  resolvedAt?: string;
}

function alertConfig() {
  const host = process.env.MYRA_ALERT_SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.MYRA_ALERT_SMTP_PORT ?? 465);
  const user = process.env.MYRA_ALERT_SMTP_USER ?? "";
  const pass = process.env.MYRA_ALERT_SMTP_PASS ?? "";
  const to = process.env.MYRA_ALERT_TO ?? "";
  const from = process.env.MYRA_ALERT_FROM ?? user;
  return { host, port, user, pass, to, from };
}

export function alertsConfigured(): boolean {
  const { user, pass, to } = alertConfig();
  return Boolean(user && pass && to);
}

// Only critical transitions (a down/recovered critical service, i.e. "the site")
// are worth an email; warnings stay on the dashboard.
export function notifiableTransitions(transitions: IncidentTransition[]): IncidentTransition[] {
  return transitions.filter((t) => t.severity === "critical");
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" });
}

export function composeIncidentEmail(t: IncidentTransition): { subject: string; text: string } {
  const dashboard = `${(process.env.MYRA_ALERT_DASHBOARD_URL ?? "https://www.suwaneegamers.net/admin/myra-health").replace(/\/$/, "")}`;
  if (t.kind === "resolved") {
    const subject = `[Suwanee Gamers] RECOVERED: ${t.displayName}`;
    const text = [
      `${t.displayName} is responding normally again.`,
      "",
      `Went down:  ${formatWhen(t.startedAt)}`,
      `Recovered:  ${formatWhen(t.resolvedAt ?? new Date().toISOString())}`,
      "",
      "Myra's monitor detected the recovery automatically.",
      `Dashboard: ${dashboard}`,
    ].join("\n");
    return { subject, text };
  }
  const subject = `[Suwanee Gamers] DOWN: ${t.displayName}`;
  const text = [
    `${t.displayName} is not responding. Myra's 24/7 monitor flagged a critical outage.`,
    "",
    `What happened: ${t.summary}`,
    t.userImpact ? `Impact:        ${t.userImpact}` : "",
    t.technicalDetails ? `Details:       ${t.technicalDetails}` : "",
    `Detected:      ${formatWhen(t.startedAt)}`,
    "",
    "You will get a follow-up email when it recovers.",
    `Dashboard: ${dashboard}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
  return { subject, text };
}

// Fire-and-forget. Never throws; logs and returns instead so a mail-server
// hiccup cannot fail the health check that triggered it.
export async function dispatchHealthAlerts(transitions: IncidentTransition[]): Promise<void> {
  const critical = notifiableTransitions(transitions);
  if (critical.length === 0) return;
  if (!alertsConfigured()) {
    console.warn(
      JSON.stringify({
        event: "myra_health_alert_skipped",
        reason: "smtp_not_configured",
        transitions: critical.map((t) => ({ kind: t.kind, service: t.service })),
      }),
    );
    return;
  }
  const { host, port, user, pass, to, from } = alertConfig();
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    for (const transition of critical) {
      const { subject, text } = composeIncidentEmail(transition);
      try {
        await transporter.sendMail({ from, to, subject, text });
        console.info(
          JSON.stringify({ event: "myra_health_alert_sent", kind: transition.kind, service: transition.service }),
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "myra_health_alert_error",
            kind: transition.kind,
            service: transition.service,
            errorCode: error instanceof Error ? error.name : "UNKNOWN",
          }),
        );
      }
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "myra_health_alert_transport_error",
        errorCode: error instanceof Error ? error.name : "UNKNOWN",
      }),
    );
  }
}
