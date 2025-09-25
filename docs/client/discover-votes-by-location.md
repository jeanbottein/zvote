# Discover Votes by Location

- **Persona**: Visitor or user with location preferences
- **Goal**: Filter and view public votes within a configurable radius of a location.
- **Desired outcome/flow**:
  - On the home page, set a radius (default 10 km, min 1 km, max 100 km client-side).
  - Optionally set or allow location at vote creation.
  - Public votes within the radius are listed.

## Acceptance criteria
- **Radius control**: User can choose 1–100 km, default 10 km.
- **Scope**: Only public votes with stored geolocation are included.
- **Privacy**: Location sharing is opt-in at creation time.

## Related
- [Visibility Model](../server/visibility-model.md)

## TODO / Questions
- Server-side geospatial indexing and query model TBD.
- What happens if a vote lacks location data?
- Clarify whether radius applies to current location or a chosen point on a map.
