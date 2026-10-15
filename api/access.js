import { db } from "hatchable";
export const access = "public";
export const methods = ["POST"];
async function sha256(text) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export default async function (req, res) {
  try {
    const token = req.body?.token;
    if (typeof token !== "string" || token.length !== 64) return res.status(401).json({ error: "Access token is missing or invalid." });
    const hash = await sha256(token);
    const { rows } = await db.query("SELECT main_product, bump_selected, amount_paise, status FROM kemp_orders WHERE access_token_hash = $1 AND status = 'paid' LIMIT 1", [hash]);
    if (!rows.length) return res.status(401).json({ error: "No verified paid order was found for this access token." });
    const order = rows[0];
    return res.json({ granted: true, product: order.main_product, bumpIncluded: order.bump_selected, amountRupees: order.amount_paise / 100, mainDelivery: "Your KEMP EYE digital order is verified. Add the final product materials to the delivery section before launching to customers.", audioDelivery: order.bump_selected ? "The audio bump was purchased. Attach the final audio asset before launch." : null });
  } catch (e) {
    console.error("access error", e?.message || "unknown");
    return res.status(500).json({ error: "Could not check access. Please try again." });
  }
}