# zvote

## Overview

zvote is an open-source proposing, a modern voting server designed to push the limits of what voting systems can achieve. It implements advanced voting methods such as Graduated Majority Judgment (GMJ) and Approval Voting, aiming for fast, reactive, and meaningful collective decision-making. Inspired by the dynamic nature of real-time interactions like "Twitch Plays Pokémon," zvote is built for quick consensus and relative decision agility.

## Key Features

- Implements **Graduated Majority Judgment**: a single-winner rated voting rule selecting candidates with the highest median score, allowing nuanced voter ratings beyond simple choices.
- Supports **Approval Voting**: voters approve any number of candidates, maximizing expressiveness and fairness.
- Built on **spacetimedb** for rapid development, responsiveness, and real-time voting updates.
- Includes a simple **TypeScript client** to test, learn, and interact with the voting server.
- Emphasizes experimentation and innovation; the project is a start and not yet polished, welcoming contributions and feedback.

## Why Graduated Majority Judgment?

Graduated Majority Judgment, improves upon majority judgment by using a continuous, line-interpolated median score to rank candidates robustly. This method:

- Selects candidates based on the majority median score from cardinal ballots.
- Uses a clear tie-breaking mechanism based on a continuous score calculation.
- Provides voting outcomes resilient to small vote changes, reducing contention and recount challenges.
- Enables voters to express nuanced opinions via graded ballots, which reflect more than just ranking.

Learn more about GMJ: [Wikipedia: Graduated Majority Judgment](https://en.wikipedia.org/wiki/Graduated_majority_judgment)

## Technology Stack

- **spacetimedb**: Real-time database foundation powering reactive voting

## Getting Started

Clone the repository and explore the voting server and client for hands-on experimentation.

```bash
git clone https://github.com/jeanbottein/zvote.git
cd zvote
./go.sh
```

## Contributing

This project is early-stage and open to contributions. All feedback, bug reports, feature ideas, and patches are welcome. Help shape the future of digital voting with zvote!

[1](https://en.wikipedia.org/wiki/Graduated_majority_judgment)
[2](https://en.wikipedia.org/wiki/Majority_judgment)
[3](https://mieuxvoter.fr/en/le-jugement-majoritaire)
[4](https://thesis.eur.nl/pub/47746/Thesis.pdf)
[5](https://crest.science/RePEc/wpstorage/2018-15.pdf)
[6](https://www.scitepress.org/Papers/2022/113194/113194.pdf)
