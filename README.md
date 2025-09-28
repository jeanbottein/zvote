# zvote

## Overview

zvote is an open-source, modern voting platform designed to push the limits of what voting systems can achieve. It implements advanced voting methods such as Graduated Majority Judgment (GMJ) and Approval Voting, aiming for fast, reactive, and meaningful collective decision-making. Inspired by the dynamic nature of real-time interactions like "Twitch Plays Pokémon," zvote is built for quick consensus and decision agility.

This repository is a first step — a working prototype focused on core mechanics, correctness, and live reactivity. The vision is much larger (outlined below), but the present goal is to deliver a simple, reliable foundation we can iterate on quickly.

## Screenshots
<img width="536" height="725" alt="Capture d’écran 2025-09-28 à 23 25 10" src="https://github.com/user-attachments/assets/01dc7199-8a34-4ae0-ab1c-c1e9701e7ba7" />


## Key Features

- **Graduated Majority Judgment (GMJ)**: a single-winner rated voting rule selecting candidates with the highest (graduated) median, enabling nuanced voter judgments with principled tie-breaking.
- **Approval Voting**: voters approve any number of candidates for simplier ballots and fairer outcomes.
- **Real-time by design**: built on spacetimedb for low-latency updates and responsive interactions.
- **Privacy-minded results**: aggregate outcomes are public; individual ballots are private by design.
- **Simple TypeScript client**: test, learn, and interact quickly with a minimal client.
- **Prototype-first**: prioritizes correctness and velocity now, with a broader roadmap ahead.

## Vision

I believe many voting systems used today are outdated. zvote aims to empower people everywhere with better, science-backed tools — from everyday choices (picking a restaurant, scheduling) to, longer term, supporting democratic reforms. The name "zvote" is a working title and may evolve with future branding.

Design values: open-source, science-based methods, dynamic/live voting, minimalist UI with tasteful gradients, and a developer-friendly API surface.

## Why Graduated Majority Judgment?

Graduated Majority Judgment improves upon majority judgment by using a continuous, line-interpolated median score to rank candidates robustly. This method:

- Selects candidates based on the majority median score from cardinal ballots.
- Uses a clear tie-breaking mechanism based on a continuous score calculation.
- Provides voting outcomes resilient to small vote changes, reducing contention and recount challenges.
- Enables voters to express nuanced opinions via graded ballots, which reflect more than just ranking.

Learn more about GMJ: [Wikipedia: Graduated Majority Judgment](https://en.wikipedia.org/wiki/Graduated_majority_judgment)

## Roadmap (Prototype → Future Vision)

This prototype focuses on GMJ and Approval Voting with live updates. The broader vision includes:

- **Live, revisable ballots over time** for more authentic consent.
- **Simple, intuitive UI** refined for clarity and speed.
- **Open API** for integrations and extensions.
- **Privacy and security first** principles in storage and transport.
- **Scalability to larger contexts** (communities, organizations, eventually civic use).

None of this dilutes the current focus: build a dependable, comprehensible core — then expand.

## Example Use Cases

- Choose restaurants or venues among friends using expressive ballots.
- Select community representatives with fairer rules (Approval or GMJ).
- Coordinate interactive experiences (e.g., Twitch Plays Pokémon) using low-latency group control.
- Explore dynamic, live decision-making where many participants (and AI assistants) collaborate in near real-time.

## Technology Stack

- **spacetimedb**: Real-time database foundation powering reactive voting

## Getting Started

Clone the repository and explore the voting server and client for hands-on experimentation.

```bash
git clone https://github.com/jeanbottein/zvote.git
cd zvote
./go.sh
```

## Licensing and Repository Structure

- The core voting logic and application code in this repository will be licensed under a permissive license such as MIT or Apache 2.0 to encourage broad adoption.
- UI/design/brand assets may live in a separate repository under a different license (e.g., Creative Commons NC/ND or custom) to protect creative work from unauthorized commercial or dataset reuse.

Refer to LICENSE files (when published) for final details.

## Contributing

This is an early-stage prototype, open to contributions. Feedback, bug reports, feature ideas, and patches are welcome — especially around correctness, usability, and real-time behavior. Help shape the future now so we can responsibly grow into the larger vision.

[1](https://en.wikipedia.org/wiki/Graduated_majority_judgment)
[2](https://en.wikipedia.org/wiki/Majority_judgment)
[3](https://mieuxvoter.fr/en/le-jugement-majoritaire)
[4](https://thesis.eur.nl/pub/47746/Thesis.pdf)
[5](https://crest.science/RePEc/wpstorage/2018-15.pdf)
[6](https://www.scitepress.org/Papers/2022/113194/113194.pdf)

