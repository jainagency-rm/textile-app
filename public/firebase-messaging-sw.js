importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDwhZBZVRdBczSlgw6CkzdIZEj7c31wvAY",
  authDomain: "textile-app-cd9fa.firebaseapp.com",
  projectId: "textile-app-cd9fa",
  storageBucket: "textile-app-cd9fa.firebasestorage.app",
  messagingSenderId: "167815836682",
  appId: "1:167815836682:web:2869218ab91052fbb81bf3",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: icon || '/logo192.png',
    badge: '/logo192.png',
  });
});
