import { DbConnection, type Vote, type VoteOption } from './generated';
import { deepEqual } from '@clockworklabs/spacetimedb-sdk';

// Basic DOM refs
const statusEl = document.getElementById('status') as HTMLDivElement;
const myVoteListEl = document.getElementById('my-vote-list') as HTMLUListElement;
const publicVoteListEl = document.getElementById('public-vote-list') as HTMLUListElement;
const detailEl = document.getElementById('detail') as HTMLDivElement;
const moduleNameEl = document.getElementById('module-name') as HTMLElement;
const serverUriEl = document.getElementById('server-uri') as HTMLElement;
const serverHostInput = document.getElementById('server-host-input') as HTMLInputElement | null;
const serverSetBtn = document.getElementById('server-set') as HTMLButtonElement | null;
const serverResetBtn = document.getElementById('server-reset') as HTMLButtonElement | null;

const createForm = document.getElementById('create-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const optionsInput = document.getElementById('options') as HTMLTextAreaElement;
const publicInput = document.getElementById('public') as HTMLInputElement;
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
  if (!createForm) return;
  createForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!conn) return;
    const title = titleInput.value.trim();
    const publicFlag = !!publicInput.checked;
    const options = optionsInput.value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (!title) {
      alert('Title is required');
      return;
    }
    if (options.length === 0) {
      alert('Please enter at least one option (one per line).');
      return;
    }
    conn.reducers.createVote(title, options, publicFlag);
    // reset
    optionsInput.value = '';
  });

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
      })
      .subscribe([
        'SELECT * FROM vote',
        'SELECT * FROM vote_option',
        'SELECT * FROM approval',
      ]);

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
  moduleNameEl.textContent = MODULE_NAME;
  serverUriEl.textContent = SERVER_URI;
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
    currentVoteId = (v as any).id as bigint;
    renderDetail();
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
