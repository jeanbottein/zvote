-- V3: ballots that say nothing about who cast them.
--
-- Portable, like V1: it runs on H2 and on PostgreSQL.
--
-- Until now ballot rows and names were keyed by the voter id, the same on
-- every poll: a copy of the database joined names to choices, and linked one
-- voter's ballots across polls and to the polls they created. Ballots and
-- names now have keys of their own, per poll, derived from the voter's token
-- under a server secret (see Voter.java). Nothing records when a ballot or a
-- name was given, which would line them up by time.
--
-- The old keys cannot be turned into new ones (the tokens were never stored):
-- the ballots and names cast so far go. Nothing was in production yet.

DELETE FROM approval;
DELETE FROM judgment;
DELETE FROM voter_name;

-- Renamed columns keep their indexes and unique constraints, on H2 as on
-- PostgreSQL.
ALTER TABLE approval RENAME COLUMN voter_id TO ballot_key;
ALTER TABLE approval DROP COLUMN cast_at;
ALTER TABLE judgment RENAME COLUMN voter_id TO ballot_key;
ALTER TABLE judgment DROP COLUMN cast_at;
ALTER TABLE voter_name RENAME COLUMN voter_id TO name_key;
ALTER TABLE voter_name DROP COLUMN named_at;

-- Chosen by the creator, once: when the results show. Watching them move as
-- people vote shows what each one chose. LIVE, AFTER_BALLOTS (once
-- results_after_ballots ballots are in) or AFTER_CLOSING.
ALTER TABLE poll ADD COLUMN results_shown VARCHAR(16) DEFAULT 'LIVE' NOT NULL;
ALTER TABLE poll ADD COLUMN results_after_ballots INT;
