/* global importScripts, firebase, self */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
firebase.messaging();

self.addEventListener("notificationclick", (event) => {
  const path = (event.notification && event.notification.data && event.notification.data.path) || "/dashboard";
  event.notification.close();
  event.waitUntil(self.clients.openWindow(path));
});
