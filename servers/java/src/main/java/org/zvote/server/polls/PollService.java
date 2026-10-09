package org.zvote.server.polls;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.zvote.server.common.InvalidRequestException;
import org.zvote.server.common.ZVoteProperties;

import java.security.SecureRandom;
import java.text.Collator;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Every rule about polls lives here: what a valid poll is, who can find it and
 * who can change it; who may vote on it, in {@link InvitationService}. Nothing
 * else can touch the poll repositories (they are package-private), so these
 * rules cannot be walked around.
 */
@Service
public class PollService {

    private static final SecureRandom RANDOM = new SecureRandom();

    /** Join codes use no look-alikes (0 and O, 1 and I and L): 31 characters, 6 of them, about 887 million codes. */
    private static final String JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int JOIN_CODE_LENGTH = 6;
    private static final Pattern NOT_IN_JOIN_CODES = Pattern.compile("[^A-Z0-9]");
    /** Tabs, line breaks and every Unicode space: a name keeps single spaces between its words. */
    private static final Pattern SPACES = Pattern.compile("[\\s\\p{Z}]+");
    /** Controls and invisible format characters (bidi overrides, zero widths), but the joiner of emoji sequences. */
    private static final Pattern INVISIBLE = Pattern.compile("[\\p{Cc}\\p{Cf}&&[^\\x{200D}]]");
    private static final long MIN_RESULTS_AFTER_BALLOTS = 3;
    /** A cloud of names says who took part; past a hundred, it would only be a list to scroll. */
    private static final int SHOWN_NAMES = 100;

    private final PollRepository polls;
    private final PollOptionRepository options;
    private final VoterNameRepository voterNames;
    private final ZVoteProperties settings;

    public PollService(PollRepository polls, PollOptionRepository options, VoterNameRepository voterNames,
                       ZVoteProperties settings) {
        this.polls = polls;
        this.options = options;
        this.voterNames = voterNames;
        this.settings = settings;
    }

    @Transactional
    public Poll create(CreatePollRequest request, String creatorId) {
        var title = validTitle(request.title());
        var labels = validLabels(request.options());
        var invitationOnly = Boolean.TRUE.equals(request.invitationOnly());
        var showVoterNames = Boolean.TRUE.equals(request.showVoterNames());
        var resultsShown = resultsShown(request.resultsShown(), invitationOnly || showVoterNames);
        var poll = polls.save(new Poll(
            null,
            randomToken(),
            newJoinCode(),
            creatorId,
            title,
            offered(request.votingSystem()),
            offered(request.visibility()),
            invitationOnly,
            showVoterNames,
            resultsShown,
            resultsShown == Poll.ResultsShown.AFTER_BALLOTS ? validThreshold(request.resultsAfterBallots()) : null,
            now(),
            null));

        var rows = new ArrayList<PollOption>(labels.size());
        for (int position = 0; position < labels.size(); position++) {
            rows.add(new PollOption(null, poll.id(), position, labels.get(position)));
        }
        options.saveAll(rows);
        return poll;
    }

    /**
     * The poll behind a share link. Holding the link is what grants access, so
     * there is no further check - that is what "unlisted" means.
     */
    public Poll find(String shareToken) {
        return polls.findByShareToken(shareToken).orElseThrow(PollNotFoundException::new);
    }

    /**
     * The poll behind a join code, typed or pasted by a person: case, spaces
     * and dashes of any kind do not matter. Like the link, knowing the code is
     * what grants access.
     */
    public Poll findByJoinCode(String joinCode) {
        var code = NOT_IN_JOIN_CODES.matcher(joinCode.toUpperCase(Locale.ROOT)).replaceAll("");
        return polls.findByJoinCode(code).orElseThrow(() -> new PollNotFoundException(
            "No poll has this code. Check it with the person who shared it."));
    }

    /**
     * Like {@link #find}, for a poll that must still accept ballots. The poll
     * stays locked until the caller's transaction ends: closing or deleting it
     * waits for the ballot being cast, or the ballot waits, then finds the poll
     * closed or gone.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Poll findOpen(String shareToken) {
        var poll = polls.findLockedByShareToken(shareToken).orElseThrow(PollNotFoundException::new);
        if (poll.isClosed()) {
            throw new PollClosedException();
        }
        return poll;
    }

    public Poll get(Long id) {
        return polls.findById(id).orElseThrow(PollNotFoundException::new);
    }

    public List<PollOption> optionsOf(Poll poll) {
        return options.findByPollIdOrderByPosition(poll.id());
    }

    /** The most recent public polls, if this server offers them. Unlisted polls are never listed. */
    public List<Poll> listPublic() {
        if (!settings.features().publicPolls()) {
            return List.of();
        }
        return polls.findTop50ByVisibilityOrderByCreatedAtDesc(Poll.Visibility.PUBLIC);
    }

    public List<Poll> listCreatedBy(String voterId) {
        return polls.findTop100ByCreatorIdOrderByCreatedAtDesc(voterId);
    }

    /**
     * Closing stops new ballots and shows the results, for good: reopening
     * would let a creator read results kept for the closing, then watch the
     * next ballots move them, and make "final" results change.
     */
    @Transactional
    public Poll close(String shareToken, String voterId) {
        var poll = createdBy(shareToken, voterId);
        return poll.isClosed() ? poll : polls.save(poll.withClosedAt(now()));
    }

    /**
     * The poll disappears at once, with its options (ON DELETE CASCADE). Its
     * ballots, names and invitations can be billions: they are removed
     * afterwards, in batches (see {@link #removedPolls()}).
     */
    @Transactional
    public Poll delete(String shareToken, String voterId) {
        var poll = createdBy(shareToken, voterId);
        polls.delete(poll);
        polls.scheduleRemoval(poll.id());
        return poll;
    }

    /** When the poll will be deleted, with its ballots. */
    public Instant expiryOf(Poll poll) {
        return poll.createdAt().plus(lifetime());
    }

    /** Deletes the polls that have outlived their lifetime, like {@link #delete}, and returns their ids. */
    @Transactional
    public List<Long> deleteExpired() {
        var cutoff = now().minus(lifetime());
        var expired = polls.findIdsCreatedBefore(cutoff);
        polls.scheduleRemovalsCreatedBefore(cutoff);
        polls.deleteCreatedBefore(cutoff);
        return expired;
    }

    /** Deleted polls whose ballots, names and invitations are still to be removed. */
    public List<Long> removedPolls() {
        return polls.findRemovals();
    }

    /** Removes up to {@code limit} names of a deleted poll; returns how many. */
    @Transactional
    public int removeSomeNames(long pollId, int limit) {
        return voterNames.deleteSome(pollId, limit);
    }

    /** Everything of a deleted poll has gone. */
    @Transactional
    public void removalDone(long pollId) {
        polls.removalDone(pollId);
    }

    /**
     * Records the name a voter gives with their ballot, or forgets it when the
     * name is blank or null (they vote anonymously, or withdrew their ballot).
     * Only a poll created to show names takes one.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void nameVoter(Poll poll, String nameKey, String rawName) {
        var name = validName(rawName);
        if (!poll.showVoterNames()) {
            if (!name.isEmpty()) {
                throw new InvalidRequestException("This poll does not show names: vote without one.");
            }
            return;
        }
        if (name.isEmpty()) {
            voterNames.deleteName(poll.id(), nameKey);
            return;
        }
        var existing = voterNames.findByPollIdAndNameKey(poll.id(), nameKey);
        if (existing.isEmpty()) {
            voterNames.save(new VoterName(null, poll.id(), nameKey, name));
        } else if (!existing.get().name().equals(name)) {
            voterNames.save(existing.get().renamed(name));
        }
    }

    /**
     * The first names of those who took part, in alphabetical order: in the
     * order they came, they would line up with the ballots as they landed.
     */
    public VoterNames voterNamesOf(Poll poll) {
        var names = voterNames.findFirstNames(poll.id(), SHOWN_NAMES + 1);
        return new VoterNames(
            names.stream().limit(SHOWN_NAMES).sorted(Collator.getInstance(Locale.ROOT)).toList(),
            names.size() > SHOWN_NAMES);
    }

    /** The name given on this poll under this name key, if any. */
    public Optional<String> voterNameOf(Poll poll, String nameKey) {
        return voterNames.findByPollIdAndNameKey(poll.id(), nameKey).map(VoterName::name);
    }

    /**
     * A name as a person typed it, with single spaces between its words and
     * none around them; blank, it is "". Refused if too long, or if it holds
     * invisible characters.
     */
    String validName(String raw) {
        var name = raw == null ? "" : SPACES.matcher(raw).replaceAll(" ").strip();
        var max = settings.limits().maxVoterNameLength();
        if (name.length() > max) {
            throw new InvalidRequestException("A name can be at most " + max + " characters long.");
        }
        if (INVISIBLE.matcher(name).find()) {
            throw new InvalidRequestException("A name can only hold visible characters.");
        }
        return name;
    }

    private Duration lifetime() {
        return Duration.ofDays(settings.limits().pollLifetimeDays());
    }

    Poll createdBy(String shareToken, String voterId) {
        var poll = find(shareToken);
        if (!poll.isCreatedBy(voterId)) {
            throw new NotPollCreatorException();
        }
        return poll;
    }

    /**
     * Live results show each ballot land, and next to a name that appears, or
     * an invitation its creator sees used, at the same moment, they show who
     * chose what: such a poll waits for closing unless its creator asks
     * otherwise.
     */
    private static Poll.ResultsShown resultsShown(Poll.ResultsShown requested, boolean showsWhoVoted) {
        if (requested != null) {
            return requested;
        }
        return showsWhoVoted ? Poll.ResultsShown.AFTER_CLOSING : Poll.ResultsShown.LIVE;
    }

    /** Below three ballots, the results are the ballots: two voters each read the other's. */
    private static long validThreshold(Long ballots) {
        if (ballots == null || ballots < MIN_RESULTS_AFTER_BALLOTS) {
            throw new InvalidRequestException(
                "Results shown after a number of ballots need at least " + MIN_RESULTS_AFTER_BALLOTS + " ballots.");
        }
        return ballots;
    }

    private String validTitle(String raw) {
        var title = raw == null ? "" : raw.strip();
        var max = settings.limits().maxTitleLength();
        if (title.isEmpty()) {
            throw new InvalidRequestException("A poll needs a title.");
        }
        if (title.length() > max) {
            throw new InvalidRequestException("A title can be at most " + max + " characters long.");
        }
        return title;
    }

    private List<String> validLabels(List<String> raw) {
        var labels = raw == null
            ? List.<String>of()
            : raw.stream().map(label -> label == null ? "" : label.strip()).toList();
        var limits = settings.limits();
        if (labels.size() < 2 || labels.size() > limits.maxOptions()) {
            throw new InvalidRequestException(
                "A poll needs between 2 and " + limits.maxOptions() + " options.");
        }
        var seen = new HashSet<String>();
        for (var label : labels) {
            if (label.isEmpty()) {
                throw new InvalidRequestException("An option cannot be empty.");
            }
            if (label.length() > limits.maxOptionLength()) {
                throw new InvalidRequestException(
                    "An option can be at most " + limits.maxOptionLength() + " characters long.");
            }
            if (!seen.add(label.toLowerCase(Locale.ROOT))) {
                throw new InvalidRequestException(
                    "\"" + label + "\" is listed twice. Each option must be different.");
            }
        }
        return labels;
    }

    private Poll.VotingSystem offered(Poll.VotingSystem votingSystem) {
        var features = settings.features();
        var offered = votingSystem != null && switch (votingSystem) {
            case MAJORITY_JUDGMENT -> features.majorityJudgment();
            case APPROVAL -> features.approvalVoting();
        };
        if (!offered) {
            throw new InvalidRequestException("Choose a voting system this server offers.");
        }
        return votingSystem;
    }

    private Poll.Visibility offered(Poll.Visibility visibility) {
        var features = settings.features();
        var offered = visibility != null && switch (visibility) {
            case PUBLIC -> features.publicPolls();
            case UNLISTED -> features.unlistedPolls();
        };
        if (!offered) {
            throw new InvalidRequestException("Choose a visibility this server offers.");
        }
        return visibility;
    }

    /**
     * The database keeps microseconds. Rounding here too means the poll this
     * service returns reads exactly as it will when read back later.
     */
    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    /**
     * Short enough to type, and drawn at random so that it says nothing about
     * other polls. A code already taken is drawn again; the unique constraint
     * catches the rare two polls drawing the same code at the same moment.
     */
    private String newJoinCode() {
        String code;
        do {
            var chars = new char[JOIN_CODE_LENGTH];
            for (int i = 0; i < chars.length; i++) {
                chars[i] = JOIN_CODE_ALPHABET.charAt(RANDOM.nextInt(JOIN_CODE_ALPHABET.length()));
            }
            code = new String(chars);
        } while (polls.existsByJoinCode(code));
        return code;
    }

    /** 128 random bits: unguessable, so that an unlisted poll stays unlisted, and an invitation its voter's. */
    static String randomToken() {
        var bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
