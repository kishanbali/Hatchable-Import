(async function () {
  const heading = document.getElementById("heading");
  const message = document.getElementById("message");
  const items = document.getElementById("items");
  const token = new URLSearchParams(location.search).get("token");
  if (!token) { heading.textContent = "Access link missing"; message.textContent = "Open the private delivery link from your completed checkout."; return; }
  try {
    const response = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const data = await response.json();
    if (!response.ok || !data.granted) throw new Error(data.error || "Access could not be confirmed.");
    heading.textContent = "Your payment is verified";
    message.textContent = "Thank you. Your order is confirmed for ₹" + data.amountRupees + ".";
    const main = document.createElement("div"); main.className = "order-row";
    const mainText = document.createElement("div"); const title = document.createElement("strong"); title.textContent = data.product;
    const desc = document.createElement("p"); desc.className = "muted"; desc.textContent = data.mainDelivery;
    mainText.append(title, desc); main.append(mainText); items.append(main);
    if (data.bumpIncluded) {
      const audio = document.createElement("div"); audio.className = "order-row";
      const audioText = document.createElement("div"); const audioTitle = document.createElement("strong"); audioTitle.textContent = "KEMP EYE Audio Recharge";
      const audioDesc = document.createElement("p"); audioDesc.className = "muted"; audioDesc.textContent = data.audioDelivery;
      audioText.append(audioTitle, audioDesc); audio.append(audioText); items.append(audio);
    }
    const warning = document.createElement("p"); warning.className = "note"; warning.textContent = "Setup note: this site currently verifies and records the order, but the final downloadable product and audio assets have not yet been attached. Add those files before public launch."; items.append(warning);
  } catch (err) { heading.textContent = "We couldn't confirm access yet"; message.textContent = err.message + " If your payment was debited, please do not pay again. Contact support with your payment ID."; }
})();