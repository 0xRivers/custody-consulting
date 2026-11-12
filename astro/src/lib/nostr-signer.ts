import { generateSecretKey, getPublicKey, type EventTemplate } from 'nostr-tools/pure';
import { BunkerSigner, createNostrConnectURI } from 'nostr-tools/nip46';
import { SimplePool } from 'nostr-tools/pool';

type SignedEvent = { pubkey: string; id: string; sig: string; kind: number; created_at: number; tags: string[][]; content: string };
export type NostrSigner = { getPublicKey(): Promise<string>; signEvent(event: EventTemplate): Promise<SignedEvent> };
export async function connectNostrSigner(status: (message: string) => void): Promise<{ signer: NostrSigner; close: () => void }> {
  const browser = (window as Window & { nostr?: NostrSigner }).nostr;
  if (browser) return { signer: browser, close: () => {} };
  if (!/Android/i.test(navigator.userAgent)) throw new Error('Enable a Nostr browser signer to continue. On Android, you can use Amber.');
  const secret = generateSecretKey();
  const pool = new SimplePool({ maxWaitForConnection: 8000 });
  const uri = createNostrConnectURI({ clientPubkey: getPublicKey(secret), relays: ['wss://relay.nip46.com', 'wss://relay.nsec.app'],
    secret: Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''),
    perms: ['sign_event:27235'], name: 'Custody Consulting', url: location.origin });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const pending = BunkerSigner.fromURI(secret, uri, { pool, skipSwitchRelays: true });
  status('Approve the connection in Amber.');
  location.href = 'intent://' + uri.slice('nostrconnect://'.length) + '#Intent;scheme=nostrconnect;package=com.greenart7c3.nostrsigner;end';
  try {
    const signer = await Promise.race([pending, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Amber did not respond. Open Amber and try again.')), 110000); })]);
    return { signer, close: () => pool.destroy() };
  } catch (error) { pool.destroy(); throw error; }
  finally { clearTimeout(timeout); }
}
