package org.zvote.server.polls;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.zvote.server.common.InvalidRequestException;
import org.zvote.server.common.ZVoteProperties;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;

/**
 * Every rule about polls lives here: what a valid poll is, who can find it and
 * who can change it. Nothing else can touch the poll repositories (they are
 * package-private), so these rules cannot be walked around.
 */
@Service
public class PollService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final PollRepository polls;
    private final PollOptionRepository options;
    private final ZVoteProperties settings;

    public PollService(PollRepository polls, PollOptionRepository options, ZVoteProperties settings) {
        this.polls = polls;
        this.options = options;
        this.settings = settings;
    }

    @Transactional
    public Poll create(CreatePollRequest request, String creatorId) {
        var title = validTitle(request.title());
        var labels = validLabels(request.options());
        var poll = polls.save(new Poll(
            null,
            newShareToken(),
            creatorId,
            title,
            offered(request.votingSystem()),
            offered(request.visibility()),
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

    /** Like {@link #find}, for a poll that must still accept ballots. */
    public Poll findOpen(String shareToken) {
        var poll = find(shareToken);
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

    /** The most recent public polls. Unlisted polls are never listed. */
    public List<Poll> listPublic() {
        return polls.findTop50ByVisibilityOrderByCreatedAtDesc(Poll.Visibility.PUBLIC);
    }

    public List<Poll> listCreatedBy(String voterId) {
        return polls.findTop100ByCreatorIdOrderByCreatedAtDesc(voterId);
    }

    /** Closing stops new ballots and keeps the results visible. It can be undone. */
    @Transactional
    public Poll setClosed(String shareToken, String voterId, boolean closed) {
        var poll = createdBy(shareToken, voterId);
        if (poll.isClosed() == closed) {
            return poll;
        }
        return polls.save(poll.withClosedAt(closed ? now() : null));
    }

    /** The options and ballots go with it (ON DELETE CASCADE). */
    @Transactional
    public Poll delete(String shareToken, String voterId) {
        var poll = createdBy(shareToken, voterId);
        polls.delete(poll);
        return poll;
    }

    private Poll createdBy(String shareToken, String voterId) {
        var poll = find(shareToken);
        if (!poll.isCreatedBy(voterId)) {
            throw new NotPollCreatorException();
        }
        return poll;
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

    /** 128 random bits: unguessable, so an unlisted poll stays unlisted. */
    private static String newShareToken() {
        var bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
