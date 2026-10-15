import { db } from "hatchable";
export const access = "public";
export const methods = ["POST"];
async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let out = 0; for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i); return out === 0;
}
async function sha256(text) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export default async function (req, res) {
  try {
    const body = req.body || {};
    const orderId = body.razorpay_order_id;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret || !orderId || !paymentId || !signature || typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string") return res.status(400).json({ error: "Missing or invalid payment details." });
    const { rows } = await db.query("SELECT id, amount_paise, status, razorpay_payment_id, access_token_hash FROM kemp_orders WHERE razorpay_order_id = $1 LIMIT 1", [orderId]);
    if (!rows.length) return res.status(404).json({ error: "Order not found." });
    const order = rows[0];
    if (order.status === "paid" && order.razorpay_payment_id === paymentId && order.access_token_hash) return res.json({ verified: true, deliveryToken: null, alreadyPaid: true });
    const expected = await hmacHex(secret, orderId + "|" + paymentId);
    if (!safeEqual(expected, signature)) return res.status(400).json({ error: "Payment signature verification failed. No access was issued." });
    const auth = btoa((process.env.RAZORPAY_KEY_ID || "") + ":" + secret);
    const check = await fetch("https://api.razorpay.com/v1/payments/" + encodeURIComponent(paymentId), { headers: { "Authorization": "Basic " + auth } });
    const payment = await check.json();
    if (!check.ok || payment.order_id !== orderId || payment.currency !== "INR" || payment.amount !== order.amount_paise || !["captured","authorized"].includes(payment.status)) return res.status(400).json({ error: "The provider has not confirmed the correct amount for this order. Access was not issued." });
    if (payment.status === "authorized" && payment.captured !== true) return res.status(409).json({ error: "Payment is authorized but not yet captured. Please wait for confirmation before accessing your product." });
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
    const tokenHash = await sha256(token);
    await db.query("UPDATE kemp_orders SET status = 'paid', razorpay_payment_id = $1, access_token_hash = $2, paid_at = NOW() WHERE razorpay_order_id = $3 AND status = 'created'", [paymentId, tokenHash, orderId]);
    const { rows: updated } = await db.query("SELECT status, access_token_hash FROM kemp_orders WHERE razorpay_order_id = $1 LIMIT 1", [orderId]);
    if (!updated.length || updated[0].status !== "paid" || updated[0].access_token_hash !== tokenHash) return res.status(409).json({ error: "Payment received; access confirmation is still processing. Contact support with your order ID." });
    return res.json({ verified: true, deliveryToken: token, bumpIncluded: payment.amount === 14800 });
  } catch (e) {
    console.error("verify-payment error", e?.message || "unknown");
    return res.status(500).json({ error: "Could not verify payment right now. Please do not pay again; retry verification or contact support." });
  }
}