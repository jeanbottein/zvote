import { DbConnection, type Vote, type VoteOption } from './generated';

// Basic DOM refs
const statusEl = document.getElementById('status') as HTMLDivElement;
const voteListEl = document.getElementById('vote-list') as HTMLUListElement;
const detailEl = document.getElementById('detail') as HTMLDivElement;
const moduleNameEl = document.getElementById('module-name') as HTMLElement;
const serverUriEl = document.getElementById('server-uri') as HTMLElement;

const createForm = document.getElementById('create-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const optionsInput = document.getElementById('options') as HTMLTextAreaElement;
const publicInput = document.getElementById('public') as HTMLInputElement;

// Connection config
const MODULE_NAME = (moduleNameEl?.textContent?.trim() || 'zvote-proto1');
const SERVER_URI = (serverUriEl?.textContent?.trim() || 'ws://localhost:3000');

let conn: DbConnection | null = null;
let currentVoteId: bigint | null = null;

function setStatus(text: string) {
  if (statusEl) statusEl.textContent = text;
}

function renderVotes() {
  if (!conn) return;
  voteListEl.innerHTML = '';
  // Iterate over all votes in client cache
  for (const v of conn.db.vote.iter() as Iterable<Vote>) {
    const li = document.createElement('li');
    const left = document.createElement('div');
    const right = document.createElement('div');
    right.className = 'item-actions';

    left.innerHTML = `<strong>${escapeHtml(v.title)}</strong> <span class="badge">#${v.id.toString()}</span>`;

    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View';
    viewBtn.className = 'secondary';
    viewBtn.addEventListener('click', () => {
      currentVoteId = v.id;
      renderDetail();
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      if (confirm(`Delete vote "${v.title}"?`)) {
        conn!.reducers.deleteVote(v.id);
      }
    });

    right.append(viewBtn, delBtn);
    li.append(left, right);
    voteListEl.appendChild(li);
  }
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
    if (opt.voteId === currentVoteId) options.push(opt);
  }
  // Sort options by approvals desc, orderIndex asc
  options.sort((a, b) => {
    if (b.approvalsCount !== a.approvalsCount) return b.approvalsCount - a.approvalsCount;
    return a.orderIndex - b.orderIndex;
  });

  const lines: string[] = [];
  lines.push(`Title: ${vote.title}`);
  lines.push(`ID: ${vote.id.toString()}`);
  lines.push('Options:');
  for (const o of options) {
    lines.push(` • ${o.label} (${o.approvalsCount})`);
  }
  detailEl.textContent = lines.join('\n');
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
}

function connect() {
  setStatus('Connecting…');
  const prevToken = localStorage.getItem('auth_token') || '';

  const onConnect = (c: DbConnection, _identity: any, token: string) => {
    conn = c;
    localStorage.setItem('auth_token', token);
    setStatus('Connected');

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
