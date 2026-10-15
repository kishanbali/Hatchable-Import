import { db } from "hatchable";
export const access = "public";
export const methods = ["POST"];
export default async function (req, res) {
  try {
    const body = req.body || {};
    const bump = body.bump === true;
    const email = typeof body.email === "string" && body.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ? body.email.trim().toLowerCase() : null;
    const amount = bump ? 14800 : 9900;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return res.status(503).json({ error: "Payments are not configured yet. Please try again later.", code: "PAYMENTS_NOT_CONFIGURED" });
    const auth = btoa(keyId + ":" + keySecret);
    const response = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { "Authorization": "Basic " + auth, "Content-Type": "application/json" }, body: JSON.stringify({ amount, currency: "INR", receipt: "kemp_" + crypto.randomUUID().replaceAll("-", "").slice(0, 24), notes: { product: "KEMP EYE Digital Experience", bump_selected: String(bump) } }) });
    const data = await response.json();
    if (!response.ok || !data.id || data.amount !== amount || data.currency !== "INR") {
      console.error("Razorpay order creation failed", response.status, data.error?.code || "unknown");
      return res.status(502).json({ error: "The payment provider could not create your order. No payment has been taken." });
    }
    await db.query("INSERT INTO kemp_orders (razorpay_order_id, email, bump_selected, amount_paise, status) VALUES ($1,$2,$3,$4,'created')", [data.id, email, bump, amount]);
    return res.json({ orderId: data.id, amount: data.amount, currency: data.currency, keyId, productName: "KEMP EYE Digital Experience", bumpSelected: bump });
  } catch (e) {
    console.error("create-order error", e?.message || "unknown");
    return res.status(500).json({ error: "Could not start checkout. Please try again." });
  }
}