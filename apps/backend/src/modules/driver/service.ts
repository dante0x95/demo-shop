import { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import Driver from "./models/driver"
import DriverInvite from "./models/driver-invite"
import { driverHasLoginError } from "./utils/errors"

export type IssueDriverInviteInput = {
  driver_id: string
  token_hash: string
  expires_at: Date
  now: Date
}

export type IssueDriverInviteResult = {
  invite: { id: string; expires_at: Date }
  // Pending invitations this one replaced (now revoked or expired).
  replaced_ids: string[]
}

class DriverModuleService extends MedusaService({
  Driver,
  DriverInvite,
}) {
  // Adds a pending invitation for the driver, replacing the pending one they
  // had: revoked if it was still valid at `now`, expired otherwise. One
  // transaction, holding the driver's row lock, so concurrent resends run one
  // after the other and the one-pending-per-driver index never trips.
  // A driver who already accepted an invitation gets none (409).
  @InjectManager()
  async issueDriverInvite(
    input: IssueDriverInviteInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<IssueDriverInviteResult> {
    return await this.issueDriverInvite_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async issueDriverInvite_(
    input: IssueDriverInviteInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<IssueDriverInviteResult> {
    const manager = sharedContext.transactionManager as SqlEntityManager

    const drivers = await manager.execute(
      `select "id" from "driver" where "id" = ? and "deleted_at" is null for update`,
      [input.driver_id]
    )

    if (!drivers.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Driver with id: ${input.driver_id} was not found`
      )
    }

    const replaced: { id: string }[] = await manager.execute(
      `update "driver_invite"
         set "status" = case when "expires_at" <= ? then 'expired' else 'revoked' end,
             "updated_at" = now()
       where "driver_id" = ? and "status" = 'pending' and "deleted_at" is null
       returning "id"`,
      [input.now, input.driver_id]
    )

    // Checked after the update: an acceptance that won the race for the
    // pending invitation has committed by now, and rolling back here leaves
    // nothing replaced.
    const accepted = await manager.execute(
      `select "id" from "driver_invite"
       where "driver_id" = ? and "status" = 'accepted' and "deleted_at" is null
       limit 1`,
      [input.driver_id]
    )

    if (accepted.length) {
      throw driverHasLoginError()
    }

    const invite = await this.createDriverInvites(
      {
        driver_id: input.driver_id,
        token_hash: input.token_hash,
        expires_at: input.expires_at,
        status: "pending",
      },
      sharedContext
    )

    return {
      invite: { id: invite.id, expires_at: invite.expires_at },
      replaced_ids: replaced.map(({ id }) => id),
    }
  }

  // Marks the invitation accepted only if, at `now`, it is still pending and
  // not expired. One conditional update, so of two requests racing for the
  // same invitation (two acceptances, or an acceptance and a resend) only one
  // wins. Returns whether this call accepted it.
  @InjectManager()
  async acceptPendingDriverInvite(
    id: string,
    now: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    return await this.acceptPendingDriverInvite_(id, now, sharedContext)
  }

  @InjectTransactionManager()
  protected async acceptPendingDriverInvite_(
    id: string,
    now: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const manager = sharedContext.transactionManager as SqlEntityManager

    const accepted = await manager.execute(
      `update "driver_invite"
         set "status" = 'accepted', "accepted_at" = ?, "updated_at" = now()
       where "id" = ? and "status" = 'pending' and "expires_at" > ?
         and "deleted_at" is null
       returning "id"`,
      [now, id, now]
    )

    return accepted.length > 0
  }

  // Undoes issueDriverInvite when the rest of its workflow failed (e.g. the
  // email could not be sent). Under the same driver row lock, and only while
  // that invitation is still the driver's pending one: if a newer resend
  // replaced it, or it was accepted, the newer state wins and the invitations
  // it replaced stay revoked or expired, so their links never come back.
  // Returns whether the replaced invitations were given back.
  @InjectManager()
  async revertIssuedDriverInvite(
    input: { created_id: string; replaced_ids: string[] },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    return await this.revertIssuedDriverInvite_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async revertIssuedDriverInvite_(
    { created_id, replaced_ids }: { created_id: string; replaced_ids: string[] },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const manager = sharedContext.transactionManager as SqlEntityManager

    // Same lock order as issueDriverInvite (driver first), so a resend
    // running now waits for this rollback or runs entirely before it.
    await manager.execute(
      `select "driver"."id" from "driver"
       join "driver_invite" on "driver_invite"."driver_id" = "driver"."id"
       where "driver_invite"."id" = ?
       for update of "driver"`,
      [created_id]
    )

    // The link was never handed out, so the row goes unless it was accepted.
    const deleted: { status: string }[] = await manager.execute(
      `delete from "driver_invite"
       where "id" = ? and "status" <> 'accepted'
       returning "status"`,
      [created_id]
    )

    if (deleted[0]?.status !== "pending" || !replaced_ids.length) {
      return false
    }

    await manager.execute(
      `update "driver_invite"
         set "status" = 'pending', "updated_at" = now()
       where "id" in (${replaced_ids.map(() => "?").join(", ")})
         and "status" in ('revoked', 'expired') and "deleted_at" is null`,
      replaced_ids
    )

    return true
  }
}

export default DriverModuleService
