// Firebase Messaging Service Worker
// This file handles background push notifications

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// Note: Hardcoded config is required for static service workers in public/ folder
firebase.initializeApp({
    apiKey: "AIzaSyC0e08wn1JbbUNHlxhpElb-Z5jsMsvsS30",
    authDomain: "campus-vibes-e34f0.firebaseapp.com",
    projectId: "campus-vibes-e34f0",
    storageBucket: "campus-vibes-e34f0.firebasestorage.app",
    messagingSenderId: "209570178737",
    appId: "1:209570178737:web:e868b3dfec82b57719e490",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] 🔔 Received background message:', payload);

    if (!payload.notification && !payload.data) {
        console.warn('[firebase-messaging-sw.js] Empty payload received');
        return;
    }

    const notificationTitle = payload.data?.title || payload.notification?.title || 'New Notification';
    const APP_ICON = 'https://firebasestorage.googleapis.com/v0/b/campus-vibes-e34f0.firebasestorage.app/o/config%2Fapp%2Fmac1024.png?alt=media&token=fcdcb54c-3962-4ae9-a596-f567dcdc3a47';

    const notificationOptions = {
        body: payload.data?.body || payload.notification?.body || 'You have a new notification',
        icon: payload.data?.imageUrl || payload.notification?.icon || APP_ICON,
        badge: APP_ICON,
        image: payload.data?.imageUrl || APP_ICON, // Big banner image
        data: {
            notificationId: payload.data?.notificationId,
            screen: payload.data?.screen,
            paramsJson: payload.data?.paramsJson,
            deeplinkUrl: payload.data?.deeplinkUrl,
        },
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification click received.');

    event.notification.close();

    const data = event.notification.data;
    let url = '/';

    if (data?.deeplinkUrl) {
        url = data.deeplinkUrl;
    } else if (data?.screen && data?.paramsJson) {
        const params = JSON.parse(data.paramsJson || '{}');

        switch (data.screen) {
            case 'post':
                url = `/posts/${params.postId}`;
                break;
            case 'club':
                url = `/clubs/${params.clubId}`;
                break;
            case 'club_requests':
                url = `/clubs/${params.clubId}/settings?tab=requests`;
                break;
            case 'profile':
                url = `/user/${params.userId}`;
                break;
            case 'settings_notifications':
                url = '/settings/notifications';
                break;
            default:
                url = '/';
        }
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if there's already a window open
                for (const client of clientList) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // If not, open a new window
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});
