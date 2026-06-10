const { setGlobalOptions } = require("firebase-functions");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

const db = admin.firestore();
const messaging = admin.messaging();

async function sendToToken(token, notification) {
  if (!token) return;
  try {
    await messaging.send({ token, notification });
  } catch (err) {
    console.error("FCM send error:", err.message);
  }
}

// a) New user registered — notify all admins
exports.onNewUserRegistration = onDocumentCreated("users/{userId}", async (event) => {
  const data = event.data.data();
  const { firmName, role, fcmToken: _unused } = data;

  const adminSnap = await db.collection("users").where("role", "==", "admin").get();
  const sends = adminSnap.docs
    .map((d) => d.data().fcmToken)
    .filter(Boolean)
    .map((token) =>
      sendToToken(token, {
        title: "New Registration",
        body: `${firmName} (${role}) has registered`,
      })
    );

  await Promise.all(sends);
});

// b) New order placed — notify all suppliers and admin
exports.onNewOrder = onDocumentCreated("orders/{orderId}", async (event) => {
  const order = event.data.data();
  const { orderNumber, buyerName } = order;

  const [supplierSnap, adminSnap] = await Promise.all([
    db.collection("users").where("role", "==", "supplier").where("status", "==", "approved").get(),
    db.collection("users").where("role", "==", "admin").get(),
  ]);

  const supplierSends = supplierSnap.docs
    .map((d) => d.data().fcmToken)
    .filter(Boolean)
    .map((token) =>
      sendToToken(token, {
        title: `New Order #${orderNumber}`,
        body: `From ${buyerName}`,
      })
    );

  const adminSends = adminSnap.docs
    .map((d) => d.data().fcmToken)
    .filter(Boolean)
    .map((token) =>
      sendToToken(token, {
        title: `New Order #${orderNumber}`,
        body: `${buyerName} placed an order`,
      })
    );

  await Promise.all([...supplierSends, ...adminSends]);
});

// c) Order status changed — notify the buyer
exports.onOrderStatusChange = onDocumentUpdated("orders/{orderId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (before.status === after.status) return;

  const { buyerId, orderNumber } = after;
  if (!buyerId) return;

  const buyerDoc = await db.collection("users").doc(buyerId).get();
  const fcmToken = buyerDoc.data()?.fcmToken;

  await sendToToken(fcmToken, {
    title: `Order #${orderNumber} Updated`,
    body: `Status: ${after.status}`,
  });
});

// d) New product added — notify all approved buyers
exports.onNewProduct = onDocumentCreated("products/{productId}", async (event) => {
  const product = event.data.data();
  const { name: productName, supplierName } = product;

  const buyerSnap = await db
    .collection("users")
    .where("role", "==", "buyer")
    .where("status", "==", "approved")
    .get();

  const sends = buyerSnap.docs
    .map((d) => d.data().fcmToken)
    .filter(Boolean)
    .map((token) =>
      sendToToken(token, {
        title: "New Product Added",
        body: `${productName} by ${supplierName}`,
      })
    );

  await Promise.all(sends);
});
