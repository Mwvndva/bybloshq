window.dataLayer = window.dataLayer || [];
function gtag() {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.protocol !== 'capacitor:' && !window.Capacitor?.isNativePlatform?.()) {
    dataLayer.push(arguments);
  }
}
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.protocol !== 'capacitor:' && !window.Capacitor?.isNativePlatform?.()) {
  gtag('js', new Date());
  gtag('config', 'G-LKRPWS2FT3');
}

