-- Votes table
CREATE TABLE IF NOT EXISTS votes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id UUID NOT NULL UNIQUE,
    creator_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    visibility VARCHAR(20) NOT NULL,
    voting_system VARCHAR(50) NOT NULL,
    limit_by_ip BOOLEAN NOT NULL DEFAULT FALSE,
    share_token VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visibility ON votes(visibility);
CREATE INDEX IF NOT EXISTS idx_creator ON votes(creator_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON votes(created_at);

-- Vote options table
CREATE TABLE IF NOT EXISTS vote_options (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    vote_id BIGINT NOT NULL,
    label VARCHAR(500) NOT NULL,
    order_index INT NOT NULL,
    approvals_count INT NOT NULL DEFAULT 0,
    FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vote_id ON vote_options(vote_id);
CREATE INDEX IF NOT EXISTS idx_vote_order ON vote_options(vote_id, order_index);

-- Approvals table (for approval voting)
CREATE TABLE IF NOT EXISTS approvals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    vote_id BIGINT NOT NULL,
    option_id BIGINT NOT NULL,
    voter_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES vote_options(id) ON DELETE CASCADE,
    UNIQUE (voter_id, option_id)
);

CREATE INDEX IF NOT EXISTS idx_vote_voter ON approvals(vote_id, voter_id);
CREATE INDEX IF NOT EXISTS idx_option ON approvals(option_id);

-- Judgments table (for majority judgment)
CREATE TABLE IF NOT EXISTS judgments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    vote_id BIGINT NOT NULL,
    option_id BIGINT NOT NULL,
    voter_id VARCHAR(255) NOT NULL,
    mention VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES vote_options(id) ON DELETE CASCADE,
    UNIQUE (voter_id, option_id)
);

CREATE INDEX IF NOT EXISTS idx_vote_voter_j ON judgments(vote_id, voter_id);
CREATE INDEX IF NOT EXISTS idx_option_j ON judgments(option_id);

-- Ballot tracker for IP limiting (we CAN implement this!)
CREATE TABLE IF NOT EXISTS ballot_tracker (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    vote_id BIGINT NOT NULL,
    user_identity VARCHAR(255) NOT NULL,
    ip_address VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vote_ip ON ballot_tracker(vote_id, ip_address);
CREATE INDEX IF NOT EXISTS idx_vote_identity ON ballot_tracker(vote_id, user_identity);
