import { DbConnection, type Vote, type VoteOption } from './generated';
import { deepEqual } from '@clockworklabs/spacetimedb-sdk';
import * as QRCode from 'qrcode';

// Basic DOM refs
const statusEl = document.getElementById('status') as HTMLDivElement | null;
const myVoteListEl = document.getElementById('my-vote-list') as HTMLUListElement;
const publicVoteListEl = document.getElementById('public-vote-list') as HTMLUListElement;
const detailEl = document.getElementById('detail') as HTMLDivElement;
const moduleNameEl = document.getElementById('module-name') as HTMLElement;
const serverUriEl = document.getElementById('server-uri') as HTMLElement;
const serverHostInput = document.getElementById('server-host-input') as HTMLInputElement | null;
const serverSetBtn = document.getElementById('server-set') as HTMLButtonElement | null;
const serverResetBtn = document.getElementById('server-reset') as HTMLButtonElement | null;

// New UI elements
const fabNewVote = document.getElementById('fab-new-vote') as HTMLButtonElement | null;
const tabMyBtn = document.getElementById('tab-my') as HTMLButtonElement | null;
const tabPublicBtn = document.getElementById('tab-public') as HTMLButtonElement | null;
const mySectionEl = document.getElementById('my-section') as HTMLElement | null;
const publicSectionEl = document.getElementById('public-section') as HTMLElement | null;

// New Vote modal
const newVoteModalEl = document.getElementById('new-vote-modal') as HTMLDivElement | null;
const newVoteCloseBtn = document.getElementById('new-vote-close') as HTMLButtonElement | null;
const nvTitleInput = document.getElementById('nv-title') as HTMLInputElement | null;
const nvPublicInput = document.getElementById('nv-public') as HTMLInputElement | null;
const nvOptionsContainer = document.getElementById('nv-options-container') as HTMLDivElement | null;
const nvCountEl = document.getElementById('nv-count') as HTMLElement | null;
const nvHintEl = document.getElementById('nv-hint') as HTMLElement | null;
const nvAddOptionBtn = document.getElementById('nv-add-option') as HTMLButtonElement | null;
const nvCreateBtn = document.getElementById('nv-create') as HTMLButtonElement | null;
const nvCancelBtn = document.getElementById('nv-cancel') as HTMLButtonElement | null;

// Detail modal
const detailModalEl = document.getElementById('detail-modal') as HTMLDivElement | null;
const detailCloseBtn = document.getElementById('detail-close') as HTMLButtonElement | null;
const identityTextEl = document.getElementById('identity-text') as HTMLElement;
const resetIdentityBtn = document.getElementById('reset-identity') as HTMLButtonElement;

// Connection config
const MODULE_NAME = (moduleNameEl?.textContent?.trim() || 'zvote-proto1');
const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
const hostForDefault = location.hostname || 'localhost';
const DEFAULT_SERVER_URI = `${scheme}://${formatHostnameForWs(hostForDefault)}:3000`;
const explicitServerText = serverUriEl?.textContent?.trim();
const overrideServerText = (typeof localStorage !== 'undefined' ? localStorage.getItem('server_uri_override') || '' : '').trim();
const SERVER_URI = (overrideServerText && overrideServerText.toLowerCase() !== 'auto')
  ? overrideServerText
  : (!explicitServerText || explicitServerText.toLowerCase() === 'auto')
    ? DEFAULT_SERVER_URI
    : explicitServerText;

let conn: DbConnection | null = null;
let currentVoteId: bigint | null = null;
let myIdentity: any = null;
let activeTab: 'my' | 'public' = 'my';
let MAX_OPTIONS = 20; // default; updated from server via get_limits reducer

// In-memory token caches to avoid repeated reducer calls
const tokenByVoteId = new Map<bigint, string>();
const voteIdByToken = new Map<string, bigint>();

function setStatus(text: string) {
  if (statusEl) statusEl.textContent = text;
}

function renderVotes() {
  if (!conn) return;
  if (myVoteListEl) myVoteListEl.innerHTML = '';
  if (publicVoteListEl) publicVoteListEl.innerHTML = '';

  // Collect and sort all votes by createdAt desc
  const allVotes: Vote[] = [];
  for (const v of conn.db.vote.iter() as Iterable<Vote>) {
    allVotes.push(v);
  }
  allVotes.sort((a, b) => compareCreatedDesc(a, b));

  let myCount = 0;
  let publicCount = 0;
  for (const v of allVotes) {
    const isMine = myIdentity && deepEqual((v as any).creator, myIdentity);
    const isPublic = !!(v as any).public;
    if (isMine && myVoteListEl) {
      appendVoteListItem(myVoteListEl, v, true);
      myCount++;
    } else if (isPublic && publicVoteListEl) {
      appendVoteListItem(publicVoteListEl, v, false);
      publicCount++;
    }
  }

  // Enable scrolling when more than 10 items
  if (myVoteListEl) myVoteListEl.classList.toggle('scrollable', myCount > 10);
  if (publicVoteListEl) publicVoteListEl.classList.toggle('scrollable', publicCount > 10);
}

function renderDetail() {
  if (!conn) return;
  if (currentVoteId == null) {
    detailEl.textContent = 'Select a vote to view details.';
    return;
  }
  const vote = conn.db.vote.id.find(currentVoteId);
  if (!vote) {
    detailEl.textContent = `Vote #${currentVoteId.toString()} not found.`;
    return;
  }

  // Collect options for this vote
  const options: VoteOption[] = [];
  for (const opt of conn.db.voteOption.iter() as Iterable<VoteOption>) {
    if ((opt as any).voteId === currentVoteId) options.push(opt);
  }
  // Sort options by approvals desc, orderIndex asc
  options.sort((a, b) => {
    if ((b as any).approvalsCount !== (a as any).approvalsCount) return (b as any).approvalsCount - (a as any).approvalsCount;
    return (a as any).orderIndex - (b as any).orderIndex;
  });

  const approved = getMyApprovedOptionIds(currentVoteId);

  // Build UI
  detailEl.innerHTML = '';
  const meta = document.createElement('div');
  meta.innerHTML = `<div><strong>Title:</strong> ${escapeHtml((vote as any).title)}</div><div><strong>ID:</strong> ${(vote as any).id.toString()}</div>`;
  detailEl.appendChild(meta);

  // Live selection: toolbar removed

  const list = document.createElement('ul');
  list.className = 'option-list';
  const selectedSet = approved;
  for (const o of options) {
    const li = document.createElement('li');
    li.className = 'option-row';

    const left = document.createElement('div');
    left.className = 'option-left';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selectedSet.has((o as any).id);
    cb.title = 'Toggle your approval for this option';
    cb.addEventListener('change', () => {
      if (cb.checked) {
        conn!.reducers.approve(currentVoteId!, (o as any).id as number);
      } else {
        conn!.reducers.unapprove(currentVoteId!, (o as any).id as number);
      }
    });
    const label = document.createElement('span');
    label.textContent = (o as any).label as string;
    left.append(cb, label);

    const right = document.createElement('div');
    right.innerHTML = `<span class="badge">${(o as any).approvalsCount}</span>`;

    li.append(left, right);
    list.appendChild(li);
  }
  detailEl.appendChild(list);

  // --- Share section ---
  const shareSection = document.createElement('div');
  shareSection.className = 'share-section';
  const shareHeader = document.createElement('div');
  shareHeader.className = 'share-title';
  shareHeader.textContent = 'Share this vote';
  const qrCanvas = document.createElement('canvas');
  qrCanvas.className = 'qr-canvas';
  const urlInput = document.createElement('input');
  urlInput.className = 'share-url';
  urlInput.readOnly = true;
  const shareUrl = buildShareUrlForVote(vote);
  urlInput.value = shareUrl;
  urlInput.addEventListener('focus', () => urlInput.select());
  QRCode.toCanvas(qrCanvas, shareUrl, { width: 160, margin: 1 }).catch((e: unknown) => console.warn('QR code error', e));
  const actions = document.createElement('div');
  actions.className = 'share-actions';
  const copyBtn = document.createElement('button');
  copyBtn.className = 'secondary';
  copyBtn.textContent = 'Copy link';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy link'), 1200);
    } catch {
      alert('Copy failed');
    }
  });
  actions.appendChild(copyBtn);
  if (navigator.share) {
    const shareBtn = document.createElement('button');
    shareBtn.textContent = 'Share…';
    shareBtn.addEventListener('click', async () => {
      try {
        await navigator.share({ title: (vote as any).title as string, url: shareUrl });
      } catch { /* user cancelled or unsupported */ }
    });
    actions.appendChild(shareBtn);
  }
  shareSection.append(shareHeader, qrCanvas, urlInput, actions);
  detailEl.appendChild(shareSection);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function wireUi() {
  resetIdentityBtn?.addEventListener('click', () => {
    if (confirm('Switch to a fresh identity? This will reconnect and give you a new identity.')) {
      localStorage.removeItem('auth_token');
      location.reload();
    }
  });

  // Allow overriding the server host at runtime
  if (serverHostInput) {
    // Prefill input with current page hostname, for convenience
    serverHostInput.placeholder = location.hostname || 'localhost';
  }
  serverSetBtn?.addEventListener('click', () => {
    const raw = (serverHostInput?.value || '').trim();
    if (!raw) {
      alert('Enter a hostname or host:port (or full ws:// URL).');
      return;
    }
    let nextUri = raw;
    const lower = raw.toLowerCase();
    if (!lower.startsWith('ws://') && !lower.startsWith('wss://')) {
      // Accept host or host:port
      const hasPort = raw.includes(':') && !raw.includes(']'); // naive, IPv6 handled below
      const isIPv6 = raw.includes(':') && !raw.includes('.');
      const hostPart = isIPv6 ? `[${raw.replace(/^\[|\]$/g, '')}]` : raw;
      const port = hasPort && !isIPv6 ? '' : ':3000';
      nextUri = `${scheme}://${hostPart}${port}`;
    }
    try {
      // Basic validation
      const u = new URL(nextUri);
      if (u.protocol !== 'ws:' && u.protocol !== 'wss:') throw new Error('Invalid protocol');
      localStorage.setItem('server_uri_override', nextUri);
      location.reload();
    } catch {
      alert('Invalid server URI. Use ws://host:port or wss://host:port');
    }
  });
  serverResetBtn?.addEventListener('click', () => {
    localStorage.removeItem('server_uri_override');
    location.reload();
  });

  // FAB + New Vote modal
  fabNewVote?.addEventListener('click', () => openNewVoteModal());
  newVoteCloseBtn?.addEventListener('click', () => closeNewVoteModal());
  nvCancelBtn?.addEventListener('click', () => closeNewVoteModal());
  nvAddOptionBtn?.addEventListener('click', () => addOptionRow(''));
  nvCreateBtn?.addEventListener('click', () => onCreateNewVote());
  detailCloseBtn?.addEventListener('click', () => closeDetailModal());

  // Tabs (mobile)
  tabMyBtn?.addEventListener('click', () => setActiveTab('my'));
  tabPublicBtn?.addEventListener('click', () => setActiveTab('public'));
  window.addEventListener('resize', updateSectionsVisibility);
  // Initial tab
  setActiveTab('my');
}

function connect() {
  setStatus('Connecting…');
  const prevToken = localStorage.getItem('auth_token') || '';

  const onConnect = (c: DbConnection, identity: any, token: string) => {
    conn = c;
    myIdentity = identity;
    localStorage.setItem('auth_token', token);
    setStatus('Connected');
    if (identityTextEl) identityTextEl.textContent = formatIdentity(identity);

    // Subscribe to data
    conn.subscriptionBuilder()
      .onApplied(() => {
        // Initial cache ready
        renderVotes();
        renderDetail();
        openFromUrl();
      })
      .subscribe([
        'SELECT * FROM vote',
        'SELECT * FROM vote_option',
        'SELECT * FROM approval',
        'SELECT * FROM server_info',
      ]);

    // Fetch server limits (e.g., max options)
    fetchServerLimits();

    // Listen for changes to re-render
    conn.db.vote.onInsert(() => renderVotes());
    conn.db.vote.onUpdate(() => renderVotes());
    conn.db.vote.onDelete(() => {
      // if current vote was deleted, clear detail
      if (currentVoteId != null && !conn!.db.vote.id.find(currentVoteId)) {
        currentVoteId = null;
      }
      renderVotes();
      renderDetail();
    });
    conn.db.voteOption.onInsert(() => renderDetail());
    conn.db.voteOption.onUpdate(() => renderDetail());
    conn.db.voteOption.onDelete(() => renderDetail());
    // Approvals affect only detail view
    conn.db.approval.onInsert(() => { renderVotes(); renderDetail(); });
    conn.db.approval.onDelete(() => { renderVotes(); renderDetail(); });
  };

  const onDisconnect = () => {
    setStatus('Disconnected');
  };

  const onConnectError = (_ctx: any, err: Error) => {
    console.error('Error connecting to SpacetimeDB:', err);
    setStatus('Error connecting');
  };

  DbConnection.builder()
    .withUri(SERVER_URI)
    .withModuleName(MODULE_NAME)
    .withToken(prevToken)
    .onConnect(onConnect)
    .onDisconnect(onDisconnect)
    .onConnectError(onConnectError)
    .build();
}

function main() {
  if (moduleNameEl) moduleNameEl.textContent = MODULE_NAME;
  if (serverUriEl) serverUriEl.textContent = SERVER_URI;
  wireUi();
  connect();
}

main();

// --- helpers ---

function appendVoteListItem(listEl: HTMLUListElement, v: Vote, isMine: boolean) {
  const li = document.createElement('li');
  const left = document.createElement('div');
  const right = document.createElement('div');
  right.className = 'item-actions';

  const voters = getUniqueVoterCount((v as any).id as bigint);
  const limit = (v as any).maxParticipants ?? (v as any).participantsLimit ?? null;
  const countText = limit ? `(${voters}/${limit})` : `${voters}`;

  left.innerHTML = `<strong>${escapeHtml((v as any).title)}</strong> <span class="badge">${countText}</span> <span class="badge">#${(v as any).id.toString()}</span>${isMine ? ' <span class="badge">me</span>' : ''}`;

  const viewBtn = document.createElement('button');
  viewBtn.textContent = 'View';
  viewBtn.className = 'secondary';
  viewBtn.addEventListener('click', () => {
    showDetailModal((v as any).id as bigint);
  });

  const delBtn = document.createElement('button');
  delBtn.textContent = 'Delete';
  if (!isMine) {
    delBtn.disabled = true;
    delBtn.title = 'Only the vote creator can delete this vote';
  }
  delBtn.addEventListener('click', () => {
    if (delBtn.disabled) return;
    if (confirm(`Delete vote "${(v as any).title}"?`)) {
      conn!.reducers.deleteVote((v as any).id);
    }
  });

  right.append(viewBtn, delBtn);
  li.append(left, right);
  // Click row to view as well
  left.style.cursor = 'pointer';
  left.addEventListener('click', () => showDetailModal((v as any).id as bigint));
  listEl.appendChild(li);
}

function getMyApprovedOptionIds(voteId: bigint): Set<number> {
  const set = new Set<number>();
  if (!conn || !myIdentity) return set;
  for (const a of conn.db.approval.iter() as Iterable<any>) {
    if ((a as any).voteId === voteId && deepEqual((a as any).voter, myIdentity)) {
      set.add((a as any).optionId as number);
    }
  }
  return set;
}

function getUniqueVoterCount(voteId: bigint): number {
  const voters = new Set<string>();
  if (!conn) return 0;
  for (const a of conn.db.approval.iter() as Iterable<any>) {
    if ((a as any).voteId === voteId) {
      voters.add(identityStableString((a as any).voter));
    }
  }
  return voters.size;
}

function identityStableString(identity: any): string {
  try {
    if (!identity) return 'null';
    if (typeof identity.toBase58 === 'function') return identity.toBase58();
    if (typeof identity.toHex === 'function') return identity.toHex();
    if (typeof identity === 'string') return identity;
    if (typeof identity.toString === 'function') return identity.toString();
    return JSON.stringify(identity);
  } catch {
    return String(identity);
  }
}

function compareCreatedDesc(a: Vote, b: Vote): number {
  const ta = getCreatedAtNumber(a);
  const tb = getCreatedAtNumber(b);
  return tb - ta;
}

function getCreatedAtNumber(v: Vote): number {
  const ts: any = (v as any).createdAt ?? (v as any).created_at ?? 0;
  if (typeof ts === 'bigint') return Number(ts);
  if (typeof ts === 'number') return ts;
  if (ts && typeof ts.toNumber === 'function') return ts.toNumber();
  return 0;
}

function formatIdentity(identity: any): string {
  try {
    if (!identity) return '—';
    let s: any = undefined;
    if (typeof identity === 'string') s = identity;
    if (!s && typeof identity.toString === 'function') s = identity.toString();
    if (s === '[object Object]') s = undefined;
    if (!s && typeof identity.toBase58 === 'function') s = identity.toBase58();
    if (!s && typeof identity.toHex === 'function') s = identity.toHex();
    if (!s) s = JSON.stringify(identity);
    const str = String(s);
    return str.length > 20 ? `${str.slice(0, 10)}…${str.slice(-6)}` : str;
  } catch {
    return '—';
  }
}

// Wrap IPv6 hosts in brackets for ws:// URIs; leave others unchanged
function formatHostnameForWs(host: string): string {
  // If already bracketed, return as-is
  if (host.startsWith('[') && host.endsWith(']')) return host;
  // Heuristic: IPv6 addresses contain ':' and no dots
  if (host.includes(':') && !host.includes('.')) {
    return `[${host}]`;
  }
  return host;
}

// Build a shareable absolute URL (initially uses ?vote=ID; token will be fetched async)
function buildShareUrlForVote(vote: Vote): string {
  try {
    const u = new URL(location.origin + location.pathname);
    const vid = (vote as any).id as bigint;
    const cached = tokenByVoteId.get(vid);
    if (cached) {
      u.searchParams.set('t', cached);
    } else {
      u.searchParams.set('vote', vid.toString());
    }
    return u.toString();
  } catch {
    return location.href;
  }
}

// Read vote ID from current URL (?vote=ID)
function getUrlVoteId(): bigint | null {
  try {
    const v = new URLSearchParams(location.search).get('vote');
    if (!v) return null;
    const n = BigInt(v);
    return n;
  } catch { return null; }
}

function getUrlVoteToken(): string | null {
  try {
    const t = new URLSearchParams(location.search).get('t');
    return t && t.length > 0 ? t : null;
  } catch { return null; }
}

function openFromUrl() { void openFromUrlAsync(); }
async function openFromUrlAsync() {
  if (!conn) return;
  const token = getUrlVoteToken();
  if (token) {
    const id = await resolveTokenToVoteId(token);
    if (id != null) {
      showDetailModal(id);
      return;
    }
  }
  const id = getUrlVoteId();
  if (id != null) showDetailModal(id);
}

async function resolveTokenToVoteId(token: string): Promise<bigint | null> {
  if (!conn) return null;
  // Cache first
  if (voteIdByToken.has(token)) return voteIdByToken.get(token)!;
  const id = await queryVoteIdByToken(token);
  if (id != null) {
    voteIdByToken.set(token, id);
  }
  return id;
}

// (token generation is server-side now)

// --- modal + tabs helpers ---

function showDetailModal(voteId: bigint) {
  currentVoteId = voteId;
  renderDetail();
  if (detailModalEl) detailModalEl.classList.remove('hidden');
  // Update URL with ?vote=ID for easy sharing
  try {
    const u = new URL(location.origin + location.pathname);
    u.searchParams.set('vote', voteId.toString());
    history.replaceState({}, '', u.toString());
  } catch {}
  // Fetch token in background and update URL if available
  void fetchTokenAndUpdateUrl(voteId);
}

async function fetchTokenAndUpdateUrl(voteId: bigint) {
  const token = await fetchVoteToken(voteId);
  if (!token) return;
  try {
    const u = new URL(location.origin + location.pathname);
    u.searchParams.set('t', token);
    history.replaceState({}, '', u.toString());
  } catch {}
  // Also update share UI if present
  const urlInput = detailEl.querySelector('input.share-url') as HTMLInputElement | null;
  const qrCanvas = detailEl.querySelector('canvas.qr-canvas') as HTMLCanvasElement | null;
  if (urlInput && qrCanvas) {
    const newUrl = buildTokenUrl(token);
    urlInput.value = newUrl;
    QRCode.toCanvas(qrCanvas, newUrl, { width: 160, margin: 1 }).catch(() => {});
  }
}

function buildTokenUrl(token: string): string {
  try {
    const u = new URL(location.origin + location.pathname);
    u.searchParams.set('t', token);
    return u.toString();
  } catch { return location.href; }
}

async function fetchVoteToken(voteId: bigint): Promise<string | null> {
  if (!conn) return null;
  // Cache first
  const cached = tokenByVoteId.get(voteId);
  if (cached) return cached;
  // Ensure server has generated it (safe no-op if it already exists)
  try { await (conn as any).reducers.ensureVoteToken(voteId); } catch {}
  // Query via a targeted subscription
  const t = await queryTokenByVoteId(voteId);
  if (!t) return null;
  tokenByVoteId.set(voteId, t);
  voteIdByToken.set(t, voteId);
  return t;
}

// --- targeted subscription helpers for vote_token ---
const subscribedByVoteId = new Set<string>();
const subscribedByToken = new Set<string>();

function voteIdKey(id: bigint): string { return id.toString(); }

async function queryTokenByVoteId(voteId: bigint): Promise<string | null> {
  if (!conn) return null;
  // If we already have this row in cache via previous subscription, read directly
  const vtTable: any = (conn.db as any).voteToken;
  if (vtTable && typeof vtTable.iter === 'function') {
    for (const row of vtTable.iter() as Iterable<any>) {
      if ((row as any).voteId === voteId) return (row as any).token as string;
    }
  }
  const key = voteIdKey(voteId);
  if (!subscribedByVoteId.has(key)) {
    subscribedByVoteId.add(key);
    await new Promise<void>((resolve) => {
      conn!.subscriptionBuilder()
        .onApplied(() => resolve())
        .subscribe([`SELECT * FROM vote_token WHERE vote_id = ${voteId.toString()}`]);
    });
  }
  // After applied, read again
  if (vtTable && typeof vtTable.iter === 'function') {
    for (const row of vtTable.iter() as Iterable<any>) {
      if ((row as any).voteId === voteId) return (row as any).token as string;
    }
  }
  return null;
}

async function queryVoteIdByToken(token: string): Promise<bigint | null> {
  if (!conn) return null;
  // If we already have this row in cache via previous subscription, read directly
  const vtTable: any = (conn.db as any).voteToken;
  if (vtTable && typeof vtTable.iter === 'function') {
    for (const row of vtTable.iter() as Iterable<any>) {
      if ((row as any).token === token) return (row as any).voteId as bigint;
    }
  }
  if (!subscribedByToken.has(token)) {
    subscribedByToken.add(token);
    const tokenSql = token.replace(/'/g, "''");
    await new Promise<void>((resolve) => {
      conn!.subscriptionBuilder()
        .onApplied(() => resolve())
        .subscribe([`SELECT * FROM vote_token WHERE token = '${tokenSql}'`]);
    });
  }
  // After applied, read again
  if (vtTable && typeof vtTable.iter === 'function') {
    for (const row of vtTable.iter() as Iterable<any>) {
      if ((row as any).token === token) return (row as any).voteId as bigint;
    }
  }
  return null;
}

function closeDetailModal() {
  if (detailModalEl) detailModalEl.classList.add('hidden');
  // Remove vote param from URL when closing
  try {
    const u = new URL(location.href);
    u.searchParams.delete('vote');
    u.searchParams.delete('t');
    const qs = u.searchParams.toString();
    history.replaceState({}, '', u.pathname + (qs ? `?${qs}` : ''));
  } catch {}
}

function openNewVoteModal() {
  if (!newVoteModalEl || !nvOptionsContainer) return;
  if (nvTitleInput) nvTitleInput.value = '';
  if (nvPublicInput) nvPublicInput.checked = true;
  nvOptionsContainer.innerHTML = '';
  addOptionRow('');
  addOptionRow('');
  updateNvCount();
  if (nvHintEl) nvHintEl.textContent = `Up to ${MAX_OPTIONS} options`;
  newVoteModalEl.classList.remove('hidden');
}

function closeNewVoteModal() {
  if (newVoteModalEl) newVoteModalEl.classList.add('hidden');
}

function addOptionRow(value: string) {
  if (!nvOptionsContainer) return;
  const current = nvOptionsContainer.querySelectorAll('input.nv-option').length;
  if (current >= MAX_OPTIONS) return;
  const row = document.createElement('div');
  row.className = 'nv-option-row';
  const input = document.createElement('input');
  input.className = 'nv-option';
  input.placeholder = `Option ${current + 1}`;
  input.value = value;
  const removeBtn = document.createElement('button');
  removeBtn.className = 'secondary';
  removeBtn.type = 'button';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', () => {
    row.remove();
    updateNvCount();
  });
  row.append(input, removeBtn);
  nvOptionsContainer.appendChild(row);
  updateNvCount();
}

function updateNvCount() {
  if (!nvOptionsContainer || !nvCountEl) return;
  const count = nvOptionsContainer.querySelectorAll('input.nv-option').length;
  nvCountEl.textContent = `${count}/${MAX_OPTIONS}`;
}

function onCreateNewVote() {
  if (!conn) return;
  const title = (nvTitleInput?.value || '').trim();
  const publicFlag = !!nvPublicInput?.checked;
  const optionInputs = Array.from(nvOptionsContainer?.querySelectorAll('input.nv-option') || []) as HTMLInputElement[];
  const options = optionInputs.map((i) => i.value.trim()).filter((s) => s.length > 0).slice(0, MAX_OPTIONS);
  if (!title) {
    alert('Title is required');
    return;
  }
  if (options.length === 0) {
    alert('Please enter at least one option.');
    return;
  }
  conn.reducers.createVote(title, options, publicFlag);
  closeNewVoteModal();
}

function setActiveTab(tab: 'my' | 'public') {
  activeTab = tab;
  tabMyBtn?.classList.toggle('active', tab === 'my');
  tabPublicBtn?.classList.toggle('active', tab === 'public');
  updateSectionsVisibility();
}

function updateSectionsVisibility() {
  const isMobile = window.matchMedia('(max-width: 900px)').matches;
  if (!mySectionEl || !publicSectionEl) return;
  if (isMobile) {
    mySectionEl.classList.toggle('hidden', activeTab !== 'my');
    publicSectionEl.classList.toggle('hidden', activeTab !== 'public');
  } else {
    mySectionEl.classList.remove('hidden');
    publicSectionEl.classList.remove('hidden');
  }
}

// --- server limits ---
async function fetchServerLimits() {
  if (!conn) return;
  // Ensure the singleton server_info row exists
  try { await (conn as any).reducers.ensureServerInfo(); } catch (e) { /* ignore */ }
  // Read from the table (available via subscription)
  try {
    const serverInfoTable: any = (conn.db as any).serverInfo;
    if (serverInfoTable && typeof serverInfoTable.iter === 'function') {
      for (const row of serverInfoTable.iter() as Iterable<any>) {
        const v = (row as any).maxOptions ?? (row as any).max_options;
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) {
          MAX_OPTIONS = n;
          updateNvCount();
          if (nvHintEl) nvHintEl.textContent = `Up to ${MAX_OPTIONS} options`;
          break;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to read server_info:', e);
  }
}
