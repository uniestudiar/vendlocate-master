const resp = await fetch('https://www.bing.com/search?q=Clean+Laundry+Cedar+Falls+IA', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
});
const text = await resp.text();

// Bing uses <cite> for URLs
const cites = [...text.matchAll(/<cite[^>]*>([^<]+)<\/cite>/gi)];
if (cites.length > 0) {
  for (const c of cites.slice(0, 5)) {
    console.log('Cite:', c[1].trim());
  }
} else {
  // Try other patterns
  const urls = [...text.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>/gi)];
  let count = 0;
  for (const u of urls) {
    const url = u[1];
    if (!url.includes('bing.com') && !url.includes('microsoft.com') && url.match(/^https?:\/\/[^\/]+\.[a-z]{2,}/)) {
      console.log('URL:', url);
      count++;
      if (count >= 5) break;
    }
  }
  if (count === 0) console.log('No URLs found. First 2000:', text.substring(0, 2000));
}
