import { Check, Undo2, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { setAccess } from "@/services/auth/auth.actions";
import type { AccessStatus } from "@/services/auth/session.token";
import type { AppUser } from "@/services/auth/users.repository";

const GROUPS: { status: AccessStatus; title: string; empty: string }[] = [
  { status: "pending", title: "Waiting for approval", empty: "No new requests." },
  { status: "approved", title: "Approved", empty: "Nobody approved yet." },
  { status: "rejected", title: "Declined", empty: "Nobody declined." },
];

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function UserList({ users, currentUid }: { users: AppUser[]; currentUid: string }) {
  return (
    <div className="space-y-8">
      {GROUPS.map((group) => {
        const members = users.filter((user) => user.status === group.status);
        return (
          <section key={group.status} className="space-y-3">
            <h2 className="text-lg font-semibold text-fg">
              {group.title} <span className="text-muted">({members.length})</span>
            </h2>
            {members.length === 0 ? (
              <p className="text-sm text-muted">{group.empty}</p>
            ) : (
              <ul className="glass divide-y divide-white/5 rounded-3xl">
                {members.map((user) => (
                  <li key={user.uid} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{user.email}</p>
                      {user.createdAt && (
                        <p className="text-xs text-muted">Signed up {dateFormat.format(user.createdAt)}</p>
                      )}
                    </div>
                    {user.uid === currentUid ? (
                      <span className="text-sm text-muted">You (admin)</span>
                    ) : (
                      <div className="flex gap-2">
                        {user.status !== "approved" && (
                          <AccessButton uid={user.uid} status="approved" variant="primary">
                            <Check className="size-4" aria-hidden /> Approve
                          </AccessButton>
                        )}
                        {user.status === "pending" && (
                          <AccessButton uid={user.uid} status="rejected" variant="danger">
                            <X className="size-4" aria-hidden /> Decline
                          </AccessButton>
                        )}
                        {user.status === "approved" && (
                          <AccessButton uid={user.uid} status="rejected" variant="danger">
                            <Undo2 className="size-4" aria-hidden /> Revoke
                          </AccessButton>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AccessButton({
  uid,
  status,
  variant,
  children,
}: {
  uid: string;
  status: AccessStatus;
  variant: "primary" | "danger";
  children: ReactNode;
}) {
  return (
    <form action={setAccess}>
      <input type="hidden" name="uid" value={uid} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant} size="sm">
        {children}
      </Button>
    </form>
  );
}
