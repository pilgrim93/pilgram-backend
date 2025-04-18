// public/analytics.js

let startTime = Date.now();

// Track time on page before unload
window.addEventListener("beforeunload", () => {
  const timeOnPage = Math.round((Date.now() - startTime) / 1000);
  navigator.sendBeacon("/api/track-behavior", JSON.stringify({
    type: "time",
    value: timeOnPage,
    path: window.location.pathname
  }));
});

// Track click events
document.addEventListener("click", (e) => {
  const target = e.target.tagName || "UNKNOWN";
  fetch("/api/track-behavior", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "click",
      value: target,
      path: window.location.pathname
    })
  });
});

// Track scroll depth
let maxScroll = 0;
window.addEventListener("scroll", () => {
  const scrollDepth = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
  if (scrollDepth > maxScroll) {
    maxScroll = scrollDepth;
    fetch("/api/track-behavior", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "scroll",
        value: maxScroll,
        path: window.location.pathname
      })
    });
  }
});
