"use client";

// Visibility management: a matrix of normal users (rows) × applications
// (columns). Checking a cell grants that user access to that application,
// instant-apply (no save step). Signal marks the checked/active cell since
// it's the interactive affordance.

import { motion, useReducedMotion } from "framer-motion";
import { useApplications } from "@/lib/applications";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function AccessMatrix() {
  const reduced = useReducedMotion();
  const applications = useApplications((s) => s.applications);
  const users = useApplications((s) => s.users);
  const toggleVisibility = useApplications((s) => s.toggleVisibility);

  const normalUsers = users.filter((u) => u.role === "user");

  const enter = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6, ease: EASE },
      };

  return (
    <>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-signal">
          Admin console
        </p>
        <h1 className="mt-3 font-display text-4xl font-black tracking-[-0.02em] text-bone sm:text-5xl">
          Access
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ash">
          Grant each staff member access to the engagements they&apos;re working
          on. Changes apply immediately to that user&apos;s portal.
        </p>
      </div>

      <motion.section
        {...enter}
        aria-label="User visibility matrix"
        className="mt-10 overflow-x-auto rounded-xl border border-ash/15 bg-pine"
      >
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-ash/10">
              <th
                scope="col"
                className="w-64 px-6 py-4 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-ash"
              >
                Staff member
              </th>
              {applications.map((app) => (
                <th
                  key={app.id}
                  scope="col"
                  className="px-4 py-4 text-left align-bottom"
                >
                  <span className="block font-mono text-[10px] tracking-[0.1em] text-ash">
                    {app.id}
                  </span>
                  <span className="mt-1 block max-w-[160px] text-[13px] font-medium leading-snug text-bone">
                    {app.title}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {normalUsers.map((user) => {
              const count = user.visibleApplicationIds.length;
              return (
                <tr key={user.id} className="border-b border-ash/10 last:border-b-0">
                  <th scope="row" className="px-6 py-5 text-left">
                    <span className="block font-display text-sm font-bold text-bone">
                      {user.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] text-ash">
                      {user.id}
                    </span>
                    <span
                      aria-live="polite"
                      className="mt-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-ash/70"
                    >
                      {count} of {applications.length} visible
                    </span>
                  </th>
                  {applications.map((app) => {
                    const checked = user.visibleApplicationIds.includes(app.id);
                    return (
                      <td key={app.id} className="px-4 py-5">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          aria-label={`${checked ? "Remove" : "Grant"} ${user.name}'s access to ${app.title}`}
                          onClick={() => toggleVisibility(user.id, app.id)}
                          className={`flex h-6 w-6 items-center justify-center rounded-md border transition ${
                            checked
                              ? "border-signal bg-signal text-void"
                              : "border-ash/30 bg-void/40 text-transparent hover:border-ash/60"
                          }`}
                        >
                          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden>
                            <path
                              d="M2.5 6.5l2.5 2.5 4.5-5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </motion.section>

      <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-ash/60">
        Admins always see every application · changes are instant
      </p>
    </>
  );
}
