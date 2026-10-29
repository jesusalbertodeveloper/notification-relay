self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'App Alert';
    const options = {
        body: data.body || 'New message from your application.',
        icon: '/icon.png'
    };
    event.waitUntil(self.registration.showNotification(title, options));
});
