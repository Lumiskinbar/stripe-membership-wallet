import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error`);
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object;

    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription,
      { expand: ["items.data.price"] }
    );

    const price = subscription.items.data[0].price;

    const creditAmount = parseInt(
      price.metadata.wallet_credit_cents || "0"
    );

    if (creditAmount > 0) {
      await stripe.customers.createBalanceTransaction(
        invoice.customer,
        {
          amount: -creditAmount,
          currency: "usd",
          description: "Lumi Essentials monthly credit"
        }
      );
    }
  }

  res.status(200).json({ received: true });
}
