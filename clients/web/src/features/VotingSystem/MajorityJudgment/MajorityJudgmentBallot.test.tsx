import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MajorityJudgmentBallot from './MajorityJudgmentBallot';
import MajorityJudgmentDropdownBallot from './MajorityJudgmentDropdownBallot';

const options = [
  { id: '1', label: 'Ramen' },
  { id: '2', label: 'Tacos' },
];

describe('the colour-scale ballot', () => {
  it('offers the seven mentions for each option, best first', () => {
    render(<MajorityJudgmentBallot options={options} ballot={{}} onChange={() => {}} />);

    const ramen = screen.getByRole('radiogroup', { name: 'Ramen' });
    expect(within(ramen).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(
      ['Excellent', 'VeryGood', 'Good', 'Fair', 'Passable', 'Inadequate', 'Bad'],
    );
  });

  it('adds the chosen mention to the ballot', async () => {
    const onChange = vi.fn();
    render(<MajorityJudgmentBallot options={options} ballot={{ 1: 'Good' }} onChange={onChange} />);

    const tacos = screen.getByRole('radiogroup', { name: 'Tacos' });
    await userEvent.click(within(tacos).getByRole('radio', { name: 'Very Good' }));

    expect(onChange).toHaveBeenCalledWith({ 1: 'Good', 2: 'VeryGood' });
  });

  it('shows the mention each option has, and which have none yet', () => {
    render(<MajorityJudgmentBallot options={options} ballot={{ 1: 'Excellent' }} onChange={() => {}} />);

    const ramen = screen.getByRole('radiogroup', { name: 'Ramen' });
    expect(within(ramen).getByRole('radio', { name: 'Excellent' })).toBeChecked();
    expect(within(screen.getByRole('radiogroup', { name: 'Tacos' })).getByText('Not rated yet')).toBeInTheDocument();
  });
});

describe('the dropdown ballot', () => {
  it('offers the same choice as a list', async () => {
    const onChange = vi.fn();
    render(<MajorityJudgmentDropdownBallot options={options} ballot={{}} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('Tacos'), 'Fair');

    expect(onChange).toHaveBeenCalledWith({ 2: 'Fair' });
  });
});
