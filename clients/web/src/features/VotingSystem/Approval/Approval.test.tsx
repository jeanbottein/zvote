import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ApprovalBallot from './ApprovalBallot';
import ApprovalResults from './ApprovalResults';

const options = [
  { id: '1', label: 'Ramen' },
  { id: '2', label: 'Tacos' },
  { id: '3', label: 'Pizza' },
];

describe('the approval ballot', () => {
  it('adds a ticked option, in the order of the poll', async () => {
    const onChange = vi.fn();
    render(<ApprovalBallot options={options} approved={['3']} onChange={onChange} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Ramen' }));

    expect(onChange).toHaveBeenCalledWith(['1', '3']);
  });

  it('removes an option ticked again', async () => {
    const onChange = vi.fn();
    render(<ApprovalBallot options={options} approved={['1', '3']} onChange={onChange} />);

    expect(screen.getByRole('checkbox', { name: 'Pizza' })).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pizza' }));

    expect(onChange).toHaveBeenCalledWith(['1']);
  });
});

describe('the approval results', () => {
  const counted = (ramen: number, tacos: number, pizza: number) => [
    { id: '1', label: 'Ramen', approvalCount: ramen, judgmentCounts: null },
    { id: '2', label: 'Tacos', approvalCount: tacos, judgmentCounts: null },
    { id: '3', label: 'Pizza', approvalCount: pizza, judgmentCounts: null },
  ];

  it('ranks the options by approvals, with the share of voters who approved each', () => {
    render(<ApprovalResults options={counted(1, 4, 4)} totalBallots={5} />);

    const [first, second, third] = screen.getAllByRole('listitem');
    expect(first).toHaveTextContent('1Tacos4 approvals · 80%');
    expect(second).toHaveTextContent('1Pizza4 approvals · 80%');
    expect(third).toHaveTextContent('3Ramen1 approval · 20%');
    expect([first, second, third].map((item) => item.dataset.winner)).toEqual(['true', 'true', 'false']);
    expect(within(third).getByLabelText('Rank 3')).toBeInTheDocument();
  });

  it('has no ranks and no winner before the first ballot', () => {
    render(<ApprovalResults options={counted(0, 0, 0)} totalBallots={0} />);

    expect(screen.queryByLabelText(/^Rank/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.dataset.winner)).toEqual(['false', 'false', 'false']);
    expect(screen.getAllByText('0 approvals')).toHaveLength(3);
  });
});
