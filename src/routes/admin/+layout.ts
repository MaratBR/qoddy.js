// The dashboard is plain server-rendered HTML and forms: no client JS, so it
// adds nothing to the app's bundle, and the service worker never caches it.
export const csr = false;
