package org.zvote.server.polls;

/** Whether a voter may cast a ballot on a poll (see {@link InvitationService}). */
public enum Admission {
    /** Anyone may vote on this poll, or this voter created it, or holds an invitation to it. */
    ADMITTED,
    /** Only invited people may vote, and this voter brought no valid invitation. */
    NOT_INVITED,
    /** The invitation this voter brought was used in another browser. */
    INVITATION_USED
}
