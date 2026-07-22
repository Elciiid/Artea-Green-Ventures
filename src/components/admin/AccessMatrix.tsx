"use client";

// Visibility management: a matrix of normal users (rows) × applications
// (columns). Checking a cell grants that user access to that application,
// instant-apply (no save step). Signal marks the checked/active cell since
// it's the interactive affordance.

import { motion } from "framer-motion";
import { useReducedMotionPref } from "@/lib/preferences";
import { useApplications } from "@/lib/applications";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function AccessMatrix() {
  const reduced = useReducedMotionPref();
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
        <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
          Admin console
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold text-bone sm:text-5xl">
          User access
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ash">
          Choose which applications each person can see. Check a box to give
          access, uncheck it to take access away. Changes save on their own and
          take effect right away.
        </p>
      </div>

      <motion.section
        {...enter}
        aria-label="Application access by user"
        className="mt-9 overflow-x-auto border-y-2 border-bone/80"
      >
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-ash/30">
              <th
                scope="col"
                className="w-64 px-4 py-3 pl-1 text-left text-label font-semibold uppercase tracking-[0.12em] text-ash"
              >
                Person
              </th>
              {applications.map((app) => (
                <th
                  key={app.id}
                  scope="col"
                  className="px-4 py-4 text-left align-bottom"
                >
                  <span className="block font-mono text-label tracking-[0.1em] text-ash">
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
                <tr key={user.id} className="border-b border-ash/15 last:border-b-0">
                  <th scope="row" className="py-5 pl-1 pr-4 text-left align-top">
                    <span className="block font-display text-sm font-bold text-bone">
                      {user.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-ash">
                      {user.id}
                    </span>
                    <span
                      aria-live="polite"
                      className="mt-1 block text-label uppercase tracking-[0.1em] text-ash"
                    >
                      Can see {count} of {applications.length}
                    </span>
                  </th>
                  {applications.map((app) => {
                    const checked = user.visibleApplicationIds.includes(app.id);
                    return (
                      <td key={app.id} className="px-4 py-5 align-top">
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

      <p className="mt-3 text-xs text-ash">
        Administrators can always see every application.
      </p>
    </>
  );
}
