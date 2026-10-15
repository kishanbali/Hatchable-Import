const bump = document.getElementById("bump");
const total = document.getElementById("total");
const pay = document.getElementById("pay");
const statusBox = document.getElementById("status");
function updateTotal() {
  const amount = bump.checked ? 148 : 99;
  total.textContent = "₹" + amount;
  pay.textContent = "Continue to secure payment · ₹" + amount;
}
bump.addEventListener("change", updateTotal);
pay.addEventListener("click", async () => {
  if (pay.disabled) return;
  pay.disabled = true;
  statusBox.textContent = "Creating your order securely…";
  try {
    const response = await fetch("/api/create-order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bump: bump.checked, email: document.getElementById("email").value.trim() })
    });
    const order = await response.json();
    if (!response.ok) throw new Error(order.error || "Checkout could not be started.");
    if (!window.Razorpay) throw new Error("Secure checkout could not load. Please refresh and try again.");
    const checkout = new Razorpay({
      key: order.keyId, amount: order.amount, currency: order.currency,
      name: "KEMP EYE", description: order.bumpSelected ? "Digital Experience + Audio Recharge" : "Digital Experience",
      order_id: order.orderId, theme: { color: "#123b35" },
      prefill: { email: document.getElementById("email").value.trim() },
      modal: { ondismiss: () => { pay.disabled = false; statusBox.textContent = "Checkout closed. No access was issued."; } },
      handler: async function (result) {
        statusBox.textContent = "Verifying payment with the server…";
        try {
          const verified = await fetch("/api/verify-payment", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result)
          });
          const data = await verified.json();
          if (!verified.ok || !data.verified || !data.deliveryToken) throw new Error(data.error || "Payment confirmation is still pending.");
          window.location.href = "/delivery.html?token=" + encodeURIComponent(data.deliveryToken);
        } catch (err) {
          statusBox.textContent = err.message + " Please do not pay again; save your payment ID and contact support.";
          pay.disabled = false;
        }
      }
    });
    checkout.on("payment.failed", function () {
      statusBox.textContent = "Payment was not completed. If money was debited, wait for provider confirmation before trying again.";
      pay.disabled = false;
    });
    checkout.open();
  } catch (err) {
    statusBox.textContent = err.message;
    pay.disabled = false;
  }
});