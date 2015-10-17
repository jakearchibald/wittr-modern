import './preroll/index.js';

self.addEventListener('fetch', function(event) {
  console.log(event.request);
});