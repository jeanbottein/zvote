# Geospatial and Country Policy

## What
- Votes may include location and country metadata to support geographic discovery.
- Clients can filter public votes by radius and by country of the vote or origin of the creator.

## Why
- Enables local civic engagement and relevance-based browsing.

## Acceptance criteria
- **Location storage**: Location is opt-in at creation and, when present, is stored for public votes.
- **Radius filtering**: Server supports queries by radius (min 1 km) for public votes.
- **Country filtering**: Server supports queries by country fields.

## Related
- [Discover Votes by Location](../client/discover-votes-by-location.md)
- [Discover Votes by Country](../client/discover-votes-by-country.md)
- [Discover by Country of Creator](../client/discover-votes-by-country-and-origin.md)

## TODO / Questions
- Define exact geospatial index and query support.
- Clarify behavior for votes without location.
- Confirm data retention and privacy for location fields.
