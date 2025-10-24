# GraphQL Schema Required for Java Backend

This document defines the GraphQL schema that the Java backend must implement to work with the client.

## Queries

### votes
Get all votes
```graphql
query GetVotes {
  votes {
    id
    title
    votingSystem
    visibility
    creatorId
    createdAt
    shareToken
    options {
      id
      voteId
      label
      orderIndex
      approvalsCount
      judgmentCounts {
        ToReject
        Insufficient
        OnlyAverage
        GoodEnough
        Good
        VeryGood
        Excellent
      }
      totalJudgments
    }
  }
}
```

### voteByToken
Get a specific vote by its share token
```graphql
query GetVoteByToken($token: String!) {
  voteByToken(token: $token) {
    id
    title
    votingSystem
    visibility
    creatorId
    createdAt
    shareToken
    options {
      id
      voteId
      label
      orderIndex
      approvalsCount
      judgmentCounts {
        ToReject
        Insufficient
        OnlyAverage
        GoodEnough
        Good
        VeryGood
        Excellent
      }
      totalJudgments
    }
  }
}
```

### serverInfo
Check server connectivity and version
```graphql
query ServerInfo {
  serverInfo {
    version
  }
}
```

## Mutations

### createVote
Create a new vote
```graphql
mutation CreateVote($input: CreateVoteInput!) {
  createVote(input: $input) {
    vote {
      id
      title
      votingSystem
      visibility
      creatorId
      createdAt
      shareToken
      options {
        id
        voteId
        label
        orderIndex
        approvalsCount
      }
    }
    error
  }
}
```

### approve
Approve an option in a vote
```graphql
mutation ApproveOption($voteId: ID!, $optionId: ID!) {
  approve(voteId: $voteId, optionId: $optionId) {
    success
  }
}
```

### unapprove
Remove approval from an option
```graphql
mutation UnapproveOption($voteId: ID!, $optionId: ID!) {
  unapprove(voteId: $voteId, optionId: $optionId) {
    success
  }
}
```

### castJudgment
Cast a majority judgment vote
```graphql
mutation CastJudgment($optionId: ID!, $mention: String!) {
  castJudgment(optionId: $optionId, mention: $mention) {
    success
  }
}
```

### deleteVote
Delete a vote (must be owner)
```graphql
mutation DeleteVote($voteId: ID!) {
  deleteVote(voteId: $voteId) {
    success
  }
}
```

## Types

### Vote
```graphql
type Vote {
  id: ID!
  title: String!
  votingSystem: String!  # "Approval" or "MajorityJudgment"
  visibility: String!    # "Public", "Private", or "Unlisted"
  creatorId: String!
  createdAt: String!     # ISO 8601 timestamp
  shareToken: String!
  options: [VoteOption!]!
}
```

### VoteOption
```graphql
type VoteOption {
  id: ID!
  voteId: ID!
  label: String!
  orderIndex: Int!
  approvalsCount: Int!
  judgmentCounts: JudgmentCounts
  totalJudgments: Int
}
```

### JudgmentCounts
```graphql
type JudgmentCounts {
  ToReject: Int!
  Insufficient: Int!
  OnlyAverage: Int!
  GoodEnough: Int!
  Good: Int!
  VeryGood: Int!
  Excellent: Int!
}
```

### CreateVoteInput
```graphql
input CreateVoteInput {
  title: String!
  votingSystem: String!  # "Approval" or "MajorityJudgment"
  visibility: String!    # "Public", "Private", or "Unlisted"
  options: [String!]!    # Array of option labels
}
```

### CreateVoteResult
```graphql
type CreateVoteResult {
  vote: Vote
  error: String
}
```

### MutationResult
```graphql
type MutationResult {
  success: Boolean!
}
```

### ServerInfo
```graphql
type ServerInfo {
  version: String!
}
```

## Notes

### Authentication
- The client will send authentication headers with each request
- Backend should extract user identity from headers
- User identity determines which votes they can see/modify

### Voting System Types
- `"Approval"` - Users can approve multiple options
- `"MajorityJudgment"` - Users rate each option on a scale

### Visibility Types  
- `"Public"` - Anyone can see and vote
- `"Unlisted"` - Anyone with the link can vote (not listed publicly)
- `"Private"` - Only invited users can vote

### Mentions (for Majority Judgment)
Valid mention values:
- `"ToReject"`
- `"Insufficient"`
- `"OnlyAverage"`
- `"GoodEnough"`
- `"Good"`
- `"VeryGood"`
- `"Excellent"`

## Implementation Checklist

- [ ] Define GraphQL schema types
- [ ] Implement Query resolvers
  - [ ] votes
  - [ ] voteByToken
  - [ ] serverInfo
- [ ] Implement Mutation resolvers
  - [ ] createVote
  - [ ] approve
  - [ ] unapprove
  - [ ] castJudgment
  - [ ] deleteVote
- [ ] Add authentication middleware
- [ ] Add authorization checks (vote ownership, visibility)
- [ ] Test all queries and mutations
- [ ] Add error handling
