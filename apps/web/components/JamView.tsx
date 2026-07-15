"use client";

import { useState } from "react";
import Link from "next/link";
import JamCard, { type JamCardData } from "@/components/JamCard";
import JamRsvpButton from "@/components/JamRsvpButton";
import JamInvitePanel, { type NewInviteEntry } from "@/components/JamInvitePanel";
import JamInviteResponse from "@/components/JamInviteResponse";
import JamInviteList from "@/components/JamInviteList";
import JamHostActions from "@/components/JamHostActions";
import JamAttendeeList from "@/components/JamAttendeeList";
import JamSetList from "@/components/JamSetList";

export type InviteEntry = {
  id: string;
  invited_user_id: string | null;
  invitee_email: string | null;
  status: string;
  display_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};

export type JamViewData = {
  jam: {
    name: string | null;
    capacity: number | null;
    host_user_id: string;
  };
  jamCardData: JamCardData;
  userId: string | null;
  rsvpStatus: "attending" | "waitlist" | "cancelled" | null;
  waitlistPosition: number | null;
  attendingCount: number;
  pendingInvite: boolean;
  isOfficial: boolean;
  isHost: boolean;
  isCoHost: boolean;
  hasFullAccess: boolean;
  showRsvp: boolean;
  canInvite: boolean;
  invitesEnabled: boolean;
  inviteList: InviteEntry[];
  alreadyInvitedIds: string[];
};

export default function JamView({
  jamId,
  inviteToken,
  data,
}: {
  jamId: string;
  inviteToken?: string;
  data: JamViewData;
}) {
  const {
    jam,
    jamCardData,
    userId,
    waitlistPosition,
    attendingCount,
    pendingInvite,
    isOfficial,
    isHost,
    isCoHost,
    showRsvp,
    canInvite,
    invitesEnabled,
    alreadyInvitedIds,
  } = data;

  const [rsvpStatus, setRsvpStatus] = useState(data.rsvpStatus);
  const [hasFullAccess, setHasFullAccess] = useState(data.hasFullAccess);
  const [inviteList, setInviteList] = useState(data.inviteList);
  const canManage = isHost || isCoHost;

  return (
    <div className="space-y-4">
      {pendingInvite && rsvpStatus !== "attending" && !isHost && <JamInviteResponse jamId={jamId} />}
      <JamCard
        jam={jamCardData}
        actions={
          <>
            {showRsvp && (
              <JamRsvpButton
                jamId={jamId}
                initialStatus={rsvpStatus}
                initialWaitlistPosition={waitlistPosition}
                attendingCount={attendingCount}
                capacity={jam.capacity}
                onStatusChange={(newStatus) => {
                  setRsvpStatus(newStatus);
                  setHasFullAccess(isOfficial || newStatus === "attending" || isHost || isCoHost);
                }}
              />
            )}
            {!userId && !isOfficial && (
              <Link
                href={`/auth?next=/jam/${jamId}${inviteToken ? `&invite=${inviteToken}` : ""}`}
                className="inline-block rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 transition-colors"
              >
                Sign in to RSVP
              </Link>
            )}
          </>
        }
      />
      {hasFullAccess && <JamSetList jamId={jamId} jamName={jam.name} canManage={canManage} />}
      {!isOfficial && <JamAttendeeList jamId={jamId} hostId={jam.host_user_id} isHost={isHost} />}
      {canInvite && invitesEnabled && (
        <JamInvitePanel
          jamId={jamId}
          alreadyInvitedIds={alreadyInvitedIds}
          onInvited={(entry: NewInviteEntry) => {
            setInviteList((prev) => [...prev, { id: crypto.randomUUID(), status: "pending", ...entry }]);
          }}
        />
      )}
      {canManage && <JamInviteList jamId={jamId} invites={inviteList} />}
      {canManage && <JamHostActions jamId={jamId} isHost={isHost} attendingCount={attendingCount} pendingInviteCount={inviteList.filter((inv) => inv.status === "pending").length} />}
    </div>
  );
}
