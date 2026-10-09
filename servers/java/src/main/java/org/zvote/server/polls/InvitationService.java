package org.zvote.server.polls;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.zvote.server.common.InvalidRequestException;
import org.zvote.server.common.ZVoteProperties;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Who may vote on a poll. Anyone holding its link, unless its creator chose
 * invitations: then they make them, numbered 1, 2, 3..., and send each link to
 * its person themselves.
 *
 * A link is signed, not stored (InvitationLinks), and an invitation has a row
 * only once something is known of it: a label, a ballot cast with it, or that
 * it was taken back. So making one invitation or a billion costs the same,
 * and every request reads a page of them at most.
 *
 * The first ballot cast with a link marks its invitation used by that browser
 * (its invitation key, see identity.Voter), which from then on votes on the
 * poll without the link, and is the only one that can. So the creator, who can
 * read every link, can neither read nor change the ballot cast with one: they
 * learn which invitations were used, never what anyone chose. They vote
 * without an invitation.
 */
@Service
public class InvitationService {

    /** How many invitations a page holds, unless asked for fewer, or more up to MAX_PAGE. */
    private static final int PAGE = 100;
    private static final int MAX_PAGE = 1000;

    private static final String NOT_INVITED =
        "Only invited people can vote on this poll. If you were invited, open the link from your invitation.";
    private static final String NOT_VALID = "This invitation link is not valid. Ask whoever invited you for a new one.";
    private static final String USED =
        "This invitation was already used, in another browser or on another device. Its ballot can only be changed there.";

    private final PollService polls;
    private final InvitationLinks links;
    private final JdbcClient jdbc;
    private final JdbcTemplate batches;
    private final ZVoteProperties settings;

    public InvitationService(PollService polls, InvitationLinks links, JdbcClient jdbc, JdbcTemplate batches,
                             ZVoteProperties settings) {
        this.polls = polls;
        this.links = links;
        this.jdbc = jdbc;
        this.batches = batches;
        this.settings = settings;
    }

    /** A poll that takes invitations is created with none (see PollCreationService). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void open(long pollId) {
        jdbc.sql("INSERT INTO invitation_count (poll_id, issued, revoked) VALUES (:poll, 0, 0)")
            .param("poll", pollId)
            .update();
    }

    /**
     * The newest invitations below number {@code before} (null: of all),
     * {@code limit} at most (null: a page). Its creator only.
     */
    public InvitationPage invitationsOf(String shareToken, String voterId, Long before, Integer limit) {
        var size = limit == null ? PAGE : limit;
        if (size < 1 || size > MAX_PAGE) {
            throw new InvalidRequestException("Ask for 1 to " + MAX_PAGE + " invitations at a time.");
        }
        var poll = takingInvitations(polls.createdBy(shareToken, voterId));
        var counts = countsOf(poll.id());
        var top = before == null ? counts.issued() : Math.min(before - 1, counts.issued());
        var bottom = Math.max(1, top - size + 1);
        var known = knownBetween(poll.id(), bottom, top);
        var invitations = new ArrayList<Invitation>();
        for (var number = top; number >= bottom; number--) {
            var row = known.get(number);
            if (row == null || !row.revoked()) {
                var token = links.tokenOf(poll.id(), number);
                invitations.add(new Invitation(number, token, linkOf(poll.shareToken(), token),
                    row == null ? null : row.label(), row != null && row.usedBy() != null));
            }
        }
        return new InvitationPage(counts.issued() - counts.revoked(), invitations, bottom > 1 ? bottom : null);
    }

    /**
     * Makes one invitation per name in {@code labels}, or {@code count}
     * anonymous ones (neither: one). Its creator only, while the poll is open.
     *
     * A creator with a list of people asks once and sends each their link, so
     * the cost of inviting a group is one update and one batch, not one
     * request per person.
     */
    @Transactional
    public void invite(String shareToken, String voterId, List<String> labels, Long count) {
        var poll = takingInvitations(polls.createdBy(shareToken, voterId));
        if (poll.isClosed()) {
            throw new PollClosedException("This poll is closed: nobody else can vote on it.");
        }
        var names = validNames(labels);
        if (!names.isEmpty() && count != null) {
            throw new InvalidRequestException("Send names, or a number of invitations, not both.");
        }
        var many = names.isEmpty() ? (count == null ? 1 : count) : names.size();
        if (many < 1) {
            throw new InvalidRequestException("Make at least one invitation.");
        }
        var max = settings.limits().maxInvitations();
        var made = jdbc.sql("UPDATE invitation_count SET issued = issued + :count WHERE poll_id = :poll AND issued <= :room")
            .param("count", many)
            .param("poll", poll.id())
            .param("room", max - many)
            .update();
        if (made == 0) {
            throw new InvalidRequestException(
                "A poll can have at most " + max + " invitations, and this one has " + countsOf(poll.id()).issued() + ".");
        }
        if (!names.isEmpty()) {
            // The update above locked the counter, so these numbers are ours.
            var last = countsOf(poll.id()).issued();
            var rows = new ArrayList<Object[]>(names.size());
            for (var i = 0; i < names.size(); i++) {
                rows.add(new Object[] {poll.id(), last - names.size() + 1 + i, names.get(i)});
            }
            batches.batchUpdate("INSERT INTO invitation (poll_id, number, label, revoked) VALUES (?, ?, ?, FALSE)",
                rows);
        }
    }

    /** One name per invitation, each following the rules of a voter's name. */
    private List<String> validNames(List<String> labels) {
        if (labels == null || labels.isEmpty()) {
            return List.of();
        }
        if (labels.size() > PAGE) {
            throw new InvalidRequestException("Name up to " + PAGE + " invitations at a time.");
        }
        var names = labels.stream().map(polls::validName).toList();
        if (names.stream().anyMatch(String::isEmpty)) {
            throw new InvalidRequestException("An invitation's name cannot be blank: leave it out instead.");
        }
        return names;
    }

    /** The link to send an invitation's person, or null if the server was not told its address. */
    private String linkOf(String shareToken, String token) {
        var address = settings.publicUrl();
        return address == null ? null : address + "/p/" + shareToken + "#invitation=" + token;
    }

    /** Takes back an invitation nobody voted with: its link stops working. Its creator only. */
    @Transactional
    public void revoke(String shareToken, String voterId, long number) {
        var poll = takingInvitations(polls.createdBy(shareToken, voterId));
        if (number < 1 || number > countsOf(poll.id()).issued()) {
            return;
        }
        var known = knownOf(poll.id(), number);
        if (known.isEmpty()) {
            jdbc.sql("INSERT INTO invitation (poll_id, number, revoked) VALUES (:poll, :number, TRUE)")
                .param("poll", poll.id())
                .param("number", number)
                .update();
        } else if (known.get().usedBy() != null) {
            throw new InvitationUsedException("Someone has voted with this invitation, so it can no longer be taken back.");
        } else if (known.get().revoked() || !takeBack(poll.id(), number)) {
            return;
        }
        jdbc.sql("UPDATE invitation_count SET revoked = revoked + 1 WHERE poll_id = :poll")
            .param("poll", poll.id())
            .update();
    }

    /** Whether this voter may vote, with the invitation they bring (the token from its link, or null). */
    public Admission admissionOf(Poll poll, String voterId, String invitationKey, String token) {
        if (admitted(poll, voterId, invitationKey)) {
            return Admission.ADMITTED;
        }
        var number = links.numberOf(poll.id(), token);
        if (number.isEmpty()) {
            return Admission.NOT_INVITED;
        }
        return knownOf(poll.id(), number.getAsLong())
            .map(row -> row.revoked() ? Admission.NOT_INVITED
                : row.usedBy() != null ? Admission.INVITATION_USED : Admission.ADMITTED)
            .orElse(Admission.ADMITTED);
    }

    /**
     * Lets this voter cast a ballot, or says why not. Voting with an unused
     * invitation marks it used by them, in the caller's transaction: of two
     * browsers voting with one link at the same moment, one is refused, or
     * told to try again (409) and then refused.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void admit(Poll poll, String voterId, String invitationKey, String token) {
        if (admitted(poll, voterId, invitationKey)) {
            return;
        }
        var number = links.numberOf(poll.id(), token)
            .orElseThrow(() -> new NotInvitedException(token == null ? NOT_INVITED : NOT_VALID));
        var known = knownOf(poll.id(), number);
        if (known.isEmpty()) {
            jdbc.sql("INSERT INTO invitation (poll_id, number, used_by, revoked) VALUES (:poll, :number, :key, FALSE)")
                .param("poll", poll.id())
                .param("number", number)
                .param("key", invitationKey)
                .update();
        } else if (known.get().revoked()) {
            throw new NotInvitedException(NOT_VALID);
        } else if (known.get().usedBy() != null || !use(poll.id(), number, invitationKey)) {
            throw new InvitationUsedException(USED);
        }
    }

    /** Removes up to {@code limit} invitations of a deleted poll, in one transaction; returns how many. */
    @Transactional
    public int removeSome(long pollId, int limit) {
        return jdbc.sql("""
                DELETE FROM invitation WHERE poll_id = :poll AND number IN (
                    SELECT number FROM invitation WHERE poll_id = :poll LIMIT :limit)
                """)
            .param("poll", pollId)
            .param("limit", limit)
            .update();
    }

    private boolean admitted(Poll poll, String voterId, String invitationKey) {
        return !poll.invitationOnly()
            || poll.isCreatedBy(voterId)
            || jdbc.sql("SELECT COUNT(*) FROM invitation WHERE poll_id = :poll AND used_by = :key")
                .param("poll", poll.id())
                .param("key", invitationKey)
                .query(Long.class).single() > 0;
    }

    private boolean use(long pollId, long number, String invitationKey) {
        return jdbc.sql("""
                UPDATE invitation SET used_by = :key
                WHERE poll_id = :poll AND number = :number AND used_by IS NULL AND NOT revoked
                """)
            .param("key", invitationKey)
            .param("poll", pollId)
            .param("number", number)
            .update() == 1;
    }

    private boolean takeBack(long pollId, long number) {
        return jdbc.sql("""
                UPDATE invitation SET revoked = TRUE, label = NULL
                WHERE poll_id = :poll AND number = :number AND used_by IS NULL AND NOT revoked
                """)
            .param("poll", pollId)
            .param("number", number)
            .update() == 1;
    }

    private static Poll takingInvitations(Poll poll) {
        if (!poll.invitationOnly()) {
            throw new InvalidRequestException("Anyone with the link can vote on this poll: it takes no invitations.");
        }
        return poll;
    }

    private Counts countsOf(long pollId) {
        return jdbc.sql("SELECT issued, revoked FROM invitation_count WHERE poll_id = :poll")
            .param("poll", pollId)
            .query((row, n) -> new Counts(row.getLong("issued"), row.getLong("revoked")))
            .single();
    }

    private Optional<Known> knownOf(long pollId, long number) {
        return jdbc.sql("SELECT number, label, used_by, revoked FROM invitation WHERE poll_id = :poll AND number = :number")
            .param("poll", pollId)
            .param("number", number)
            .query(Known.MAPPER)
            .optional();
    }

    private Map<Long, Known> knownBetween(long pollId, long bottom, long top) {
        return jdbc.sql("""
                SELECT number, label, used_by, revoked FROM invitation
                WHERE poll_id = :poll AND number BETWEEN :bottom AND :top
                """)
            .param("poll", pollId)
            .param("bottom", bottom)
            .param("top", top)
            .query(Known.MAPPER)
            .list().stream()
            .collect(Collectors.toMap(Known::number, Function.identity()));
    }

    private record Counts(long issued, long revoked) {}

    /** What is stored of an invitation, if anything (see V1__init.sql). */
    private record Known(long number, String label, String usedBy, boolean revoked) {

        static final RowMapper<Known> MAPPER = (row, n) -> new Known(
            row.getLong("number"), row.getString("label"), row.getString("used_by"), row.getBoolean("revoked"));
    }
}
