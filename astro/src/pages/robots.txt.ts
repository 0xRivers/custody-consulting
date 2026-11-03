export const prerender = true;
export function GET() {
  // Staging must remain crawlable for its noindex header/meta to be observed.
  return new Response('User-agent: *\nAllow: /\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
