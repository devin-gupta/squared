import "server-only";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { validPushSubscription } from "./validation";
export function pushConfigured() {
  return !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
export async function pushReadiness() {
  if (!pushConfigured()) return false;
  try {
    const { error } = await adminClient()
      .from("push_deliveries")
      .select("id")
      .limit(0)
      .abortSignal(AbortSignal.timeout(5000));
    return !error;
  } catch {
    return false;
  }
}
// Notification failures must never undo or misreport a successful expense save.
// Queue claims and lease tokens prevent concurrent requests from sending the same job.
export async function dispatchPush(actorId: string | null = null) {
  if (!pushConfigured()) return;
  const client = adminClient();
  const deadline = Date.now() + 45000;
  for (let batch = 0; batch < 4 && Date.now() < deadline; batch++) {
    const { data: jobs, error } = await client.rpc("claim_push_deliveries", {
      batch_size: 20,
      requested_actor: actorId,
    });
    if (error) {
      console.error("Push queue unavailable", error.code);
      return;
    }
    if (!jobs?.length) return;
    for (let offset = 0; offset < jobs.length; offset += 10) {
      await Promise.all(
        jobs.slice(offset, offset + 10).map(async (job: any) => {
          const subscription = {
            endpoint: job.endpoint,
            keys: { p256dh: job.p256dh, auth: job.auth },
          };
          let state = "sent",
            retryAt = new Date().toISOString();
          try {
            // Validate again: database rows are not trusted network destinations.
            if (!validPushSubscription(subscription)) {
              state = "failed";
            } else
              await webpush.sendNotification(
                subscription,
                JSON.stringify({
                  title: "Squared",
                  body: `${String(job.actor_name).slice(0, 80)} added an expense in ${String(job.trip_name).slice(0, 120)}.`,
                  tripId: job.trip_id,
                  changeId: job.change_id,
                  recipientId: job.recipient,
                }),
                {
                  TTL: 3600,
                  urgency: "normal",
                  timeout: 5000,
                  vapidDetails: {
                    subject:
                      process.env.NEXT_PUBLIC_SITE_URL ||
                      "https://squared-omega.vercel.app",
                    publicKey: process.env.VAPID_PUBLIC_KEY!,
                    privateKey: process.env.VAPID_PRIVATE_KEY!,
                  },
                },
              );
          } catch (error: any) {
            if (error?.statusCode === 404 || error?.statusCode === 410) {
              await client
                .from("push_subscriptions")
                .delete()
                .eq("id", job.device_id)
                .eq("user_id", job.recipient);
              return;
            }
            const retry =
              !error?.statusCode ||
              error.statusCode === 429 ||
              error.statusCode >= 500;
            state = retry && job.attempt < 4 ? "pending" : "failed";
            retryAt = new Date(
              Date.now() + Math.min(3600, 60 * 2 ** job.attempt) * 1000,
            ).toISOString();
            // Do not log endpoints, encryption keys, payloads or provider response bodies.
            console.warn("Push delivery deferred", {
              status: Number(error?.statusCode) || 0,
            });
          }
          const { error: ackError } = await client
            .from("push_deliveries")
            .update({
              state,
              not_before: retryAt,
              lease_token: null,
              lease_until: null,
            })
            .eq("id", job.job_id)
            .eq("lease_token", job.token);
          if (ackError)
            console.error("Push acknowledgment unavailable", ackError.code);
        }),
      );
    }
  }
}
