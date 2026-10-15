// Shared publishable anonymous configuration; this is not an administrator secret.
window.YARD_CLOUD_CONFIG = {
  env: 'chuanzhibei-d3gvmowp1e63d7f33',
  region: 'ap-shanghai',
  accessKey:
    'eyJhbGciOiJSUzI1NiIsImtpZCI6IjVhMjM3YWNlLTIzYmYtNGQwNC1hMDBlLWJkMmU2MzBmMDA3MiJ9.eyJpc3MiOiJodHRwczovL2NodWFuemhpYmVpLWQzZ3Ztb3dwMWU2M2Q3ZjMzLmFwLXNoYW5naGFpLnRjYi1hcGkudGVuY2VudGNsb3VkYXBpLmNvbSIsInN1YiI6ImFub24iLCJhdWQiOiJjaHVhbnpoaWJlaS1kM2d2bW93cDFlNjNkN2YzMyIsImV4cCI6NDA5NDgwOTAyMywiaWF0IjoxNzkxMTI1ODIzLCJub25jZSI6Il9JXzFpS1JlUmxDYkFlZEFOQkNTTnciLCJhdF9oYXNoIjoiX0lfMWlLUmVSbENiQWVkQU5CQ1NOdyIsIm5hbWUiOiJBbm9ueW1vdXMiLCJzY29wZSI6ImFub255bW91cyIsInByb2plY3RfaWQiOiJjaHVhbnpoaWJlaS1kM2d2bW93cDFlNjNkN2YzMyIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.ZWTbDXg5plFXJyWvsvmwAKT5rP22xNo0SX-ADl2_morcXKmPrWAK3lI3Rdq8UmzsUyq1cZ7y01ISxscYqmNs6FD3p1qMEtRF9zAew7hqp8Jgyar62iULYznr7pxMGP-Z4nJ39J7arFL3G2pH5mAfUpfjNUVIurXMI1-XFcBwVwbWhENHvObY9N5X2TBQQbchfBd0HIDo9JSO0OxgvpuKtw5GvdVPtHDuuBOxuLWgW333KrXHSREkL-k2tMB56hWkRYsO1qXJ1MMS1-YTJNU4GS42FjmqCMwd4RgsbWc1vTQ1AVxq4WTn2ih0rM2Sdaw_T88L3fxPcqhauJ01X4uW6g'
};

// Local review is isolated: no SDK, API calls, or cloud mutations.
window.YARD_LOCAL_REVIEW = location.protocol === 'file:' || ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
window.YARD_CLOUD_READY = new Promise(resolve => {
  if (window.YARD_LOCAL_REVIEW) {
    const notice = document.getElementById('localReviewNotice');
    if (notice) notice.hidden = false;
    resolve();
    return;
  }
  const sdk = document.createElement('script');
  sdk.src = 'https://static.cloudbase.net/cloudbase-js-sdk/3.9.2/cloudbase.full.js';
  sdk.onload = resolve;
  sdk.onerror = resolve;
  document.head.append(sdk);
});
