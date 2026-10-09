package org.zvote.server.api.dto;

/**
 * An option's GMJ score, as the exact fraction it is computed as:
 * (ballots above the majority mention - ballots below it) / ballots at it.
 *
 * A fraction rather than a number because that is what ranking compares. Past
 * about seventy million ballots two different scores can round to the same
 * double, and two equal ones can round apart - either of which would move an
 * option in the results. Divide it for display, never to compare.
 */
public record Score(long numerator, long denominator) {}
