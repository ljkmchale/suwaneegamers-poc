import { RotateCcw, Wrench } from "lucide-react";
import {
  proposeRemediationApplication,
  type RemediationAuditEntry,
  type RemediationEntry,
} from "@/lib/assistantRemediation";
import {
  approveRemediationAction,
  dismissRemediationAction,
  testRemediationAction,
  undoRemediationAction,
} from "@/app/admin/voice-assistant/actions";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RemediationPanel({
  entries,
  audit,
}: {
  entries: RemediationEntry[];
  audit: RemediationAuditEntry[];
}) {
  const applied = audit.filter((entry) => entry.action === "applied");
  return (
    <>
      <section className="mb-6 rounded-xl border border-amber-500/30 bg-[#0f0a1a] p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-cinzel text-sm uppercase tracking-widest">
              <Wrench size={17} className="text-amber-400" aria-hidden="true" />
              Myra remediation queue
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[#6a5a78]">
              Test the proposed correction, adjust its exact key and value if needed, then
              approve and apply it. Every applied change is recorded and reversible.
            </p>
          </div>
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-amber-300">
            {entries.length} pending
          </span>
        </div>
        {entries.length === 0 ? (
          <p className="rounded-lg border border-[#201927] bg-[#08050f] py-8 text-center text-xs text-[#6a5a78]">
            No weak answers are waiting for review.
          </p>
        ) : (
          <div className="space-y-3">
            {entries.slice(0, 20).map((entry) => {
              const proposal = proposeRemediationApplication(entry);
              return (
                <article key={entry.id} className="rounded-lg border border-[#201927] bg-[#08050f] p-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#1c1330] px-2 py-0.5 text-[9px] uppercase tracking-widest text-violet-300">
                          {entry.category.replaceAll("-", " ")}
                        </span>
                        <span className="text-[10px] text-[#5a5060]">
                          {entry.source.replaceAll("-", " ")} · seen {entry.timesSeen}×
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-[#e8dfc8]">“{entry.question}”</p>
                      <p className="mt-2 text-xs leading-relaxed text-[#a89880]">
                        <span className="text-[#6a5a78]">Proposed correction: </span>
                        {entry.proposedCorrection}
                      </p>
                      <p className="mt-2 text-[10px] text-[#5a5060]">
                        Evidence: {entry.evidence.length ? entry.evidence.join(" · ") : "No grounded source yet"}
                      </p>
                      {entry.testResult ? (
                        <div className="mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                          <p className="text-[9px] uppercase tracking-widest text-emerald-300">Test result</p>
                          {entry.testResult.correctedQuestion !== entry.testResult.originalQuestion ? (
                            <p className="mt-1 text-[10px] text-[#6a5a78]">
                              Tested as: {entry.testResult.correctedQuestion}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs leading-relaxed text-[#c8bda8]">{entry.testResult.answer}</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <form action={approveRemediationAction} className="space-y-2">
                        <input type="hidden" name="id" value={entry.id} />
                        <input type="hidden" name="kind" value={proposal.kind} />
                        <label className="block text-[9px] uppercase tracking-widest text-[#5a5060]">
                          Key or heard text
                          <input
                            name="key"
                            defaultValue={proposal.key}
                            required
                            className="mt-1 w-full rounded-md border border-[#2a2a35] bg-[#08050f] px-3 py-2 text-xs normal-case tracking-normal text-[#e8dfc8]"
                          />
                        </label>
                        <label className="block text-[9px] uppercase tracking-widest text-[#5a5060]">
                          Correction
                          <textarea
                            name="value"
                            defaultValue={proposal.value}
                            required
                            rows={3}
                            className="mt-1 w-full rounded-md border border-[#2a2a35] bg-[#08050f] px-3 py-2 text-xs normal-case tracking-normal text-[#e8dfc8]"
                          />
                        </label>
                        <button type="submit" className="w-full rounded-md bg-emerald-600 px-3 py-2 text-[10px] uppercase tracking-widest text-white hover:bg-emerald-500">
                          Approve and apply
                        </button>
                        <button
                          type="submit"
                          formAction={testRemediationAction}
                          className="w-full rounded-md border border-violet-500/40 px-3 py-2 text-[10px] uppercase tracking-widest text-violet-300 hover:border-violet-300"
                        >
                          Test correction
                        </button>
                      </form>
                      <form action={dismissRemediationAction}>
                        <input type="hidden" name="id" value={entry.id} />
                        <button type="submit" className="w-full rounded-md border border-[#2a2a35] px-3 py-2 text-[10px] uppercase tracking-widest text-[#9080a0] hover:border-red-400 hover:text-red-300">
                          Dismiss
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-cinzel text-sm uppercase tracking-widest">
              <RotateCcw size={17} className="text-violet-300" aria-hidden="true" />
              Remediation history
            </h2>
            <p className="mt-2 text-xs text-[#6a5a78]">Applied changes remain reversible here.</p>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-[#5a5060]">{applied.length} changes</span>
        </div>
        {applied.length === 0 ? (
          <p className="rounded-lg border border-[#201927] bg-[#08050f] py-6 text-center text-xs text-[#6a5a78]">
            Applied corrections will appear here.
          </p>
        ) : (
          <div className="space-y-2">
            {applied.slice(0, 12).map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#201927] bg-[#08050f] p-3">
                <div className="min-w-0">
                  <p className="text-xs text-[#c8bda8]">
                    {entry.application.kind.replaceAll("-", " ")}: {entry.application.key} → {entry.application.value}
                  </p>
                  <p className="mt-1 text-[10px] text-[#5a5060]">
                    {dateTime(entry.createdAt)} · {entry.application.target}
                    {entry.undoneAt ? " · undone" : ""}
                  </p>
                </div>
                {!entry.undoneAt ? (
                  <form action={undoRemediationAction}>
                    <input type="hidden" name="auditId" value={entry.id} />
                    <button type="submit" className="rounded-md border border-red-500/30 px-3 py-2 text-[10px] uppercase tracking-widest text-red-300 hover:border-red-300">
                      Undo
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
