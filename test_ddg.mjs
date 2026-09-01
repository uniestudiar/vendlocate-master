const resp = await fetch('https://www.bing.com/search?q=Clean+Laundry+Cedar+Falls+IA', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
});
const text = await resp.text();
console.log('Status:', resp.status);
// Look for cite tags (Bing uses <cite> for result URLs)
const citeMatch = text.match(/<cite[^>]*>([^<]+)<\/cite>/i);
if (citeMatch) {
  console.log('Cite:', citeMatch[1]);
} else {
  const urlMatch = text.match(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*class="[^"]*tilk[^"]*"/i);
  if (urlMatch) {
    console.log('URL:', urlMatch[1]);
  } else {
    console.log('First 1500:', text.substring(0, 1500));
  }
}
