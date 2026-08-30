import { NextRequest, NextResponse } from "next/server";
import {
  authenticatedExpenseClient,
  ExpenseRequestError,
} from "@/lib/transactions/server";
import {
  validPushEndpoint,
  validPushSubscription,
} from "@/lib/push/validation";
import { pushConfigured } from "@/lib/push/server";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const { client, user } = await authenticatedExpenseClient(request);
    const raw = await request.text();
    if (raw.length > 5000)
      throw new ExpenseRequestError("Invalid device subscription.", 400);
    const body = JSON.parse(raw);
    const endpoint = body.subscription?.endpoint || body.endpoint;
    if (!validPushEndpoint(endpoint))
      throw new ExpenseRequestError(
        "This browser’s push service is not supported.",
        400,
      );
    if (body.action === "status") {
      const { data, error } = await client
        .from("push_subscriptions")
        .select("id,expires_at")
        .eq("endpoint", endpoint)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error)
        throw new ExpenseRequestError(
          "Notification setup isn’t available yet.",
          503,
        );
      return NextResponse.json({
        enabled: !!data && Date.parse(data.expires_at) > Date.now(),
      });
    }
    if (body.action === "unsubscribe") {
      const { error } = await client
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", endpoint)
        .eq("user_id", user.id);
      if (error)
        throw new ExpenseRequestError(
          "Couldn’t disable this device. Try again.",
          503,
        );
      return NextResponse.json({ enabled: false });
    }
    if (
      body.action !== "subscribe" ||
      !validPushSubscription(body.subscription)
    )
      throw new ExpenseRequestError("Invalid device subscription.", 400);
    if (!pushConfigured())
      throw new ExpenseRequestError(
        "Notification setup isn’t available yet.",
        503,
      );
    const { error } = await client.rpc("register_push_subscription", {
      push_endpoint: endpoint,
      push_p256dh: body.subscription.keys.p256dh,
      push_auth: body.subscription.keys.auth,
    });
    if (error)
      throw new ExpenseRequestError(
        error.code === "22023"
          ? error.message
          : "Couldn’t save this device. Notification setup may still be pending.",
        error.code === "22023" ? 400 : 503,
      );
    return NextResponse.json({ enabled: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ExpenseRequestError
            ? error.message
            : "Couldn’t update notifications.",
      },
      { status: error instanceof ExpenseRequestError ? error.status : 400 },
    );
  }
}
