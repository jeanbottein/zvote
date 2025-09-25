# See Public Votes

- **Persona**: Visitor or authenticated user
- **Goal**: Discover and browse all votes that are publicly visible.
- **Desired outcome/flow**:
  - From the home page, see a list of public votes.
  - List is sorted from newest to oldest.
  - Clicking an entry opens the vote detail page (view + voting interface).
  - Counts/graphs update live while the page is open.

## Acceptance criteria
- **Listing**: Public votes are displayed with title, visibility badge, and last-created sort order.
- **Navigation**: Clicking an item opens its detail view.
- **Real-time**: Approval counts and majority-judgment aggregations refresh live without reload.

## Related
- [Aggregation Strategy](../server/aggregation-strategy.md)
- [Majority Judgment Graphs](./majority-judgment-graphs.md)
- [Approval Live Counts](./approval-live-counts.md)
- [Visibility Model](../server/visibility-model.md)

## TODO / Questions
- Should pagination or infinite scroll be added for large numbers of public votes?
