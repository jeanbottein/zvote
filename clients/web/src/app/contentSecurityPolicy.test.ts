import caddyfile from '../../../../deploy/Caddyfile?raw';
import indexHtml from '../../index.html?raw';

/**
 * The deployed site lets index.html's inline scripts run by their hashes
 * (deploy/Caddyfile): a script changed without its hash would be blocked.
 */
describe('the content security policy', () => {
  it("allows each of index.html's inline scripts", async () => {
    const scripts = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);

    expect(scripts).not.toHaveLength(0);
    for (const script of scripts) {
      const hash = `'sha256-${await sha256(script)}'`;
      expect(caddyfile, `deploy/Caddyfile's script-src must allow ${hash}`).toContain(hash);
    }
  });
});

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}
