"use client";

import { useState } from "react";
import Link from "next/link";
import JamCard, { JamMap, type JamCardData } from "@/components/JamCard";
import JamRsvpButton from "@/components/JamRsvpButton";
import JamInvitePanel, { type NewInviteEntry } from "@/components/JamInvitePanel";
import JamInviteResponse from "@/components/JamInviteResponse";
import JamInviteList from "@/components/JamInviteList";
import JamHostActions from "@/components/JamHostActions";
import JamAttendeeList from "@/components/JamAttendeeList";
import JamSetList from "@/components/JamSetList";
import TicketPurchasePanel from "@/components/TicketPurchasePanel";

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
  /** Whether the event has ticket tiers at all — decides where the map goes. */
  hasTicketTiers: boolean;
  isHost: boolean;
  isCoHost: boolean;
  hasFullAccess: boolean;
  canManage: boolean;
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
    hasTicketTiers,
    isHost,
    isCoHost,
    canManage,
    showRsvp,
    canInvite,
    invitesEnabled,
    alreadyInvitedIds,
  } = data;

  const [rsvpStatus, setRsvpStatus] = useState(data.rsvpStatus);
  const [hasFullAccess, setHasFullAccess] = useState(data.hasFullAccess);
  const [inviteList, setInviteList] = useState(data.inviteList);

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
                  setHasFullAccess(isOfficial || newStatus === "attending" || canManage);
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
      {/* Official events sell tickets instead of taking RSVPs — showRsvp is false
          for them. Directly under the description on purpose: read the pitch,
          then buy.

          The map rides along on the right at sm and up. The ticket column is
          deliberately narrow, which left most of the page width empty next to
          it, and "where" is the other thing someone weighs while deciding —
          so it earns the space better than whitespace does. Below sm the two
          stack, tickets first. */}
      {isOfficial && hasTicketTiers && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
          <TicketPurchasePanel
            jamId={jamId}
            isSignedIn={!!userId}
            timezone={jamCardData.timezone}
          />
          {/* mt-8 clears the "Tickets" heading (20px line-height + the panel's
              12px space-y-3), so the map frame starts level with the first tier
              rather than with the heading that labels only the left column.
              items-stretch then takes the margin off the height, so the frame
              still ends level with the Buy button. */}
          <JamMap
            jam={jamCardData}
            className="h-52 w-full sm:mt-8 sm:h-auto sm:min-h-52 sm:flex-1"
          />
        </div>
      )}
      {hasFullAccess && <JamSetList jamId={jamId} jamName={jam.name} canManage={canManage} />}
      {/* Official events show who's going too. Ticket buyers get an attending
          RSVP from the Stripe webhook, so the list is populated the same way —
          guests without an account are the one gap, which is what the sign-up
          nudge on the completion page is for. */}
      <JamAttendeeList jamId={jamId} hostId={isOfficial ? null : jam.host_user_id} isHost={isHost} />
      {canInvite && invitesEnabled && (
        <JamInvitePanel
          jamId={jamId}
          alreadyInvitedIds={alreadyInvitedIds}
          onInvited={(entry: NewInviteEntry) => {
            setInviteList((prev) => [...prev, { id: crypto.randomUUID(), status: "pending", ...entry }]);
          }}
        />
      )}
      {/* Everything else — a community jam, or an official event selling
          through tickets_url — has no ticket column for the map to sit beside,
          so it keeps the full-width slot at the foot. */}
      {!(isOfficial && hasTicketTiers) && <JamMap jam={jamCardData} />}
      {canManage && <JamInviteList jamId={jamId} invites={inviteList} />}
      {canManage && <JamHostActions jamId={jamId} isHost={isHost} isOfficial={isOfficial} attendingCount={attendingCount} pendingInviteCount={inviteList.filter((inv) => inv.status === "pending").length} />}
    </div>
  );
}
