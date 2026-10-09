import type { ReactNode } from 'react';
import { useServerInfo } from '../polls/useServerInfo';

export const SOURCE_CODE_URL = 'https://github.com/jeanbottein/zvote';

interface Reference {
  authors: string;
  year: number;
  title: string;
  /** Journal, volume and pages, or publisher. */
  source: string;
  url: string;
  /** What the work brings to zvote. */
  note: string;
}

const REFERENCES: Reference[] = [
  {
    authors: 'Michel Balinski and Rida Laraki',
    year: 2007,
    title: 'A theory of measuring, electing, and ranking',
    source: 'Proceedings of the National Academy of Sciences 104(21), 8720–8725',
    url: 'https://doi.org/10.1073/pnas.0702634104',
    note: 'Introduces majority judgment: grade, then rank by the median grade.',
  },
  {
    authors: 'Michel Balinski and Rida Laraki',
    year: 2011,
    title: 'Majority Judgment: Measuring, Electing, and Ranking',
    source: 'MIT Press',
    url: 'https://doi.org/10.7551/mitpress/9780262015134.001.0001',
    note: 'The book: the theory, its properties, and real elections and juries.',
  },
  {
    authors: 'Michel Balinski and Rida Laraki',
    year: 2014,
    title: "Judge: Don't vote!",
    source: 'Operations Research 62(3), 483–511',
    url: 'https://doi.org/10.1287/opre.2014.1269',
    note: 'Why grading avoids the paradoxes of ranking, and resists manipulation.',
  },
  {
    authors: 'Adrien Fabre',
    year: 2021,
    title: 'Tie-breaking the highest median: alternatives to the majority judgment',
    source: 'Social Choice and Welfare 56, 101–124',
    url: 'https://doi.org/10.1007/s00355-020-01269-9',
    note: 'The "usual judgment" score zvote uses to break ties between equal majority mentions.',
  },
  {
    authors: 'Steven J. Brams and Peter C. Fishburn',
    year: 1978,
    title: 'Approval voting',
    source: 'American Political Science Review 72(3), 831–847',
    url: 'https://doi.org/10.2307/1955105',
    note: 'The case for approving every acceptable option.',
  },
  {
    authors: 'Jean-François Laslier',
    year: 2009,
    title: 'The leader rule: a model of strategic approval voting in a large electorate',
    source: 'Journal of Theoretical Politics 21(1), 113–136',
    url: 'https://doi.org/10.1177/0951629808097286',
    note: 'How people vote strategically under approval voting, and what comes of it.',
  },
  {
    authors: 'Allan Gibbard',
    year: 1973,
    title: 'Manipulation of voting schemes: a general result',
    source: 'Econometrica 41(4), 587–601',
    url: 'https://doi.org/10.2307/1914083',
    note: 'With Satterthwaite: every reasonable voting rule can be gamed. The question is how much.',
  },
  {
    authors: 'Mark A. Satterthwaite',
    year: 1975,
    title: "Strategy-proofness and Arrow's conditions",
    source: 'Journal of Economic Theory 10(2), 187–217',
    url: 'https://doi.org/10.1016/0022-0531(75)90050-2',
    note: 'The same result, found independently.',
  },
];

/** What zvote is, how it decides, the research it rests on, and who makes it. */
export default function AboutPage() {
  const { limits } = useServerInfo();
  return (
    <>
      <title>About · zvote</title>
      <section className="hero">
        <h1>About zvote</h1>
        <p>
          A free, open-source way for a group to decide together: where to eat, where to go, what to
          pick. No account, no ads, no tracking. Polls are deleted {limits.pollLifetimeDays} days after they
          are created.
        </p>
      </section>

      <Section title="How the results are decided">
        <p>
          Picking a single favourite throws most of what people think away. Two similar options split
          their supporters, and an option most people find fine can lose to one that half the group
          dislikes. zvote asks for more than a single choice, in one of two ways.
        </p>
        <h3>Majority judgment</h3>
        <p>
          Every voter grades every option, from <em>Excellent</em> to <em>Bad</em>. An option's{' '}
          <strong>majority mention</strong> is the best grade that more than half of the voters give
          it or better: its median. The option with the best majority mention wins. When several share
          it, the <strong>GMJ score</strong> decides between them: it measures how far the grades lean
          above or below that mention. Options still equal are shown <em>ex aequo</em>, and no hidden
          rule picks one.
        </p>
        <h3>Approval voting</h3>
        <p>
          Every voter ticks each option they would be happy with. The option approved by the most
          voters wins. It is quick, and it never punishes you for supporting more than one option.
        </p>
      </Section>

      <Section title="The science behind it">
        <p>
          No voting rule is perfect: Condorcet saw in 1785 that a group can prefer A to B, B to C and
          C to A, and later results showed that every reasonable rule can be gamed. Grading rather than
          ranking sidesteps much of this. That is why majority judgment's authors studied how judges
          score figure skaters and wines as well as how citizens elect.
        </p>
        <ol className="references">
          {REFERENCES.map((reference) => (
            <li key={reference.url}>
              <span>{reference.authors} ({reference.year}). </span>
              <a href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a>
              <span>. <em>{reference.source}</em>.</span>
              <span className="hint">{reference.note}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Who makes it">
        <p>
          zvote is made by one person in Québec, in their free time, and is free for everyone. Its code
          is open: anyone can read how ballots are counted, run their own copy, or suggest a change.
        </p>
        <p>
          <a href={SOURCE_CODE_URL} target="_blank" rel="noreferrer">See the source code on GitHub</a>
        </p>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel about-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
