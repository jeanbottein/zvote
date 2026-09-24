export interface ApprovalStanding {
  id: string;
  label: string;
  approvals: number;
  /** 1 for the most approved. Options with as many approvals share a rank: 1, 1, 3. */
  rank: number;
}

/** The options, most approved first; ties keep the poll's order. */
export function rankByApprovals(
  options: { id: string; label: string; approvalCount: number | null }[],
): ApprovalStanding[] {
  const sorted = options
    .map((option) => ({ id: option.id, label: option.label, approvals: option.approvalCount ?? 0 }))
    .sort((a, b) => b.approvals - a.approvals);
  return sorted.map((option) => ({
    ...option,
    rank: 1 + sorted.filter((other) => other.approvals > option.approvals).length,
  }));
}
