# After TV for TouchDesigner

After TV's listening and editing modules, as bricks you can wire into a TouchDesigner network. Each brick does one thing TouchDesigner does not do natively. Wire it to native operators, to another brick, or to your own network.

The bricks call the project's own Python modules (`scripts/beatgrid`) unchanged. The same code runs the After TV web page, so a brick hears what the page hears.

## What TouchDesigner already does, and what the bricks add

TouchDesigner already handles these, so the bricks don't redo any of them:

| You need | Use the native tool |
|---|---|
| Sound in | Audio Device In CHOP, Audio File In CHOP |
| Spectrum, filters, levels | Audio Spectrum, Audio Filter, Analyze CHOPs; low/mid/high levels from the `audioAnalysis` palette component |
| A simple kick or snare pulse | `audioAnalysis` (Palette > Tools) |
| Tempo | Beat CHOP (timeline, tap tempo), Ableton Link CHOP, TDAbleton |
| Sending and receiving OSC | OSC In / OSC Out CHOP and DAT |
| Playing and mixing the loops | Movie File In TOP, Level TOP, Composite TOP |

No native operator does any of the following, so these are the bricks:

| Brick | What it adds | Built on |
|---|---|---|
| `aftertv_kick` | Kick (30 to 120 Hz), snare, hi-hat and note-attack pulses, plus the bass level in dB. These are the detectors the rest of the listening was tuned on. | `kick.py` |
| `aftertv_grille` | A beat grid locked to the kick. Tempo comes from your Beat CHOP, Ableton Link or taps; the brick snaps the phase to the music and re-locks when the grid drifts off-beat. | `clock.py` |
| `aftertv_sections` | **Break or drop**, beat by beat, and a prediction of when the section should change. It runs from the sound, or from channels you already have (for example the `audioAnalysis` kick and low level). | `sections.py` |
| `aftertv_oreille` | The whole After TV ear: break and drop, the part of the track (intro, verse, build, chorus, break, outro), the position in the phrase, the drop countdown, a section coming back, and optionally fine listening (density, rhythm pattern, groove, texture, mix build-up, chorus). | `oreille_web.py`, `structure.py` |
| `aftertv_montage` | The After TV editor, applied to your loops: which loop goes on which of 3 layers, where to start it, opacity and additive blend, a pulse on every cut. It also decides the suspension, hyper and one-shot modes. | `pilote_web.py`, `regles_montage.json` |

Every brick has a **sound** input (input 1) and a **control** input (input 2). It reads control channels by name, so any operator can feed it: a Beat CHOP, another brick, a button, a Select CHOP that renames channels.

## Setup

1. Get the repository (clone or ZIP). The bricks read `touchdesigner/` and `scripts/` from it.
2. TouchDesigner 2023.11290 or later (Python 3.11 with numpy built in). Nothing else to install.
3. Open the Textport (Alt+T) and run this line, with your own path:

   ```
   p = r"C:\path\to\after-tv\touchdesigner\construit.py"; exec(open(p, encoding="utf-8").read(), {"__file__": p})
   ```

   The script builds each brick in `/project1` and saves it as a `.tox` in `touchdesigner/tox/`. It also builds a demo chain, `aftertv_demo`: Audio Device In → Grille → Oreille → Montage → 3 movie layers playing the example loops. Any step that fails is reported in the Textport, and the other steps still run.

A `.tox` saved this way holds no path from your computer. When it opens, it looks for `touchdesigner/` here, in order:

1. the component's `Dossiertd` parameter (Infos page);
2. the `AFTERTV_TD` environment variable;
3. `<project folder>/touchdesigner`;
4. `<project folder>/after-tv/touchdesigner`.

## The bricks, input by input

Pulses are 1 for one frame. Values hold until they change. Text values that are not numbers go to the `textes` Table DAT inside the component, among them the part name, the rhythm pattern, the chord and the key.

### aftertv_kick

- **In:** sound.
- **Out:**
  - `kick`, `caisse` (snare), `hihat`, `note` (pulses);
  - `grave_db` (bass level, dB);
  - `depuis_kick` (seconds since the last kick).

### aftertv_grille

- **In:**
  - sound;
  - control `bpm` (for example the `bpm` of a Beat CHOP or of Ableton Link);
  - `tap` (pulses, tap tempo);
  - `un` (pulse: this is beat one).
- **Parameters:** `Bpm` (starting tempo), `Phrase` (bars per phrase).
- **Out:**
  - `temps` (beat pulse);
  - `premier` (downbeat pulse);
  - `temps_mesure` (1 to 4);
  - `mesure` (bar count);
  - `phrase` (0 to 1 through the phrase);
  - `rampe` (0 to 1 through the beat);
  - `bpm`;
  - `confiance`;
  - `kick_cale` (pulse when a kick landed on the grid).

Without `un`, the grid starts on the first kick that is followed by another one or two beats later. It re-locks by itself when it falls off-beat.

### aftertv_sections

- **In:** a beat channel `temps` or `pulse` (from `aftertv_grille` or a Beat CHOP), `premier` or `bar` for the downbeat, and `force_drop` / `force_break` (pulses, for manual buttons).
- **Parameters:**
  - `Source`: `son` measures the bass and the kick from the sound input. `canaux` reads them from the control input: a `kick` pulse, plus `grave_db` in dB or `low` (linear) from `audioAnalysis` with `Gravelineaire` on.
- **Out:**
  - `drop`, `break`;
  - `section` (1 drop, 2 break);
  - `bascule` (pulse on each switch);
  - `mesures_dans_section`;
  - `mesures_avant_suite`, plus `suite_drop` / `suite_break`: what the prediction expects next, and in how many bars;
  - `niveau_db`, `reference_db`, `kick_temps`.

How it decides: each beat's bass level is compared with the median of the current section, and the kick confirms it. A clear step of 10 dB or more across two beats, with the kick agreeing, switches after two beats. A weaker step takes two bars. A build that never reaches the previous drop's level waits up to four bars. The prediction is only shown; it never triggers anything.

### aftertv_oreille

- **In:** sound; a beat channel (`temps` / `pulse`), `premier` / `bar`, `bpm` (passed through for Montage), `force_drop` / `force_break`.
- **Parameters:**
  - `Fine`: fine listening. It costs most of the CPU; see Costs below.
  - `Kick`: `son` uses the project's kick detector. `canal` reads a `kick` pulse from the control input instead.
- **Out:**
  - `drop`, `break`;
  - `partie` (1 to 6: intro, couplet, montee, refrain, break, outro) and one channel per part (`partie_intro`…);
  - `confiance`, `mesure`, `rang`;
  - `place_phrase` (bar within the 8-bar phrase);
  - `drop_dans` (bars until the announced drop, -1 when no drop is announced);
  - `revient`, `revient_comme`, `revient_fin_dans` (a section you already heard is back);
  - `montee_signe`;
  - `grave`, `medium`, `aigu` (dB);
  - with `Fine`: the `fine_*` channels (`fine_plein`, `fine_monte`, `fine_fill`, `fine_crash`, `fine_montee`, `fine_refrain`…).

### aftertv_montage

- **In:** the output of `aftertv_oreille` (or your own `temps`, `drop`, `break`, `partie`, `kick_temps`, `bpm` channels).
- **Parameters:**
  - `Loops`: a `tags.json` written by the tagger (`scripts/aftertv/tagueur.py`), or a `manifest.json` written by `prepare.py`;
  - `Dossierloops`: the folder of loops;
  - `Mood`;
  - `Oreille`: the path of an `aftertv_oreille` component. With it, the editor also reacts to fine listening, as the web page does.
- **Out:**
  - for each layer `cN` (N = 1 to 3): `cN_loop` (row in the loop list, -1 when there is none), `cN_depart` (start point, 0 to 1 of the loop), `cN_opacite`, `cN_add` (additive blend), `cN_coupe` (cut pulse);
  - `suspension`, `hyper`, `one_shot`, `ecrans`, `bpm`.

  The `couches` Table DAT gives the file of each layer: `op('aftertv_montage/couches')[1, 'fichier']` drives a Movie File In TOP.

## Mixing bricks and native operators

Two examples:

- **Break/drop from `audioAnalysis` alone.** Use Select CHOPs to rename its kick to `kick` and its low level to `low`, add a beat (`pulse` from a Beat CHOP), and merge them into the control input of `aftertv_sections`. Set `Source` to `canaux` and turn `Gravelineaire` on.
- **Your own tempo source.** Feed an Ableton Link CHOP into the control input of `aftertv_grille`. Its `bpm` sets the tempo, and the brick locks the phase on the kick.

## Running the ear outside TouchDesigner (OSC)

`touchdesigner/osc/aftertv_osc.py` runs the chain Grille → Oreille → Montage in its own process and sends every channel over OSC, so the listening takes nothing from TouchDesigner's frame time.

```
pip install numpy python-osc sounddevice
python touchdesigner/osc/aftertv_osc.py --liste
python touchdesigner/osc/aftertv_osc.py --entree "Loopback" --bpm 126 --port 10000
python touchdesigner/osc/aftertv_osc.py --fichier track.wav --loops examples/tags.json --dossier examples/loops
```

In TouchDesigner:

1. Add an OSC In CHOP on port 10000 for the numbers. It receives `/aftertv/grille/*`, `/aftertv/oreille/*` and `/aftertv/montage/*`, plus the `/aftertv/kick`, `/aftertv/caisse`, `/aftertv/hihat` and `/aftertv/note` pulses.
2. Add an OSC In DAT for the text, under `/aftertv/texte/...`: the part, the rhythm pattern, and each layer's file.
3. To send your tempo, add an OSC Out CHOP to port 10001 carrying `bpm`. You can also send `tap`, `un`, `force_drop` and `force_break`.

To hear the computer's own sound, pick a loopback input: Stereo Mix, BlackHole or VB-Cable. `--sans-fine` drops fine listening.

## Costs

Measured on a single core, for a 60 fps network:

| Brick | Core usage | Per frame |
|---|---|---|
| aftertv_kick | 9 % | 1.5 ms |
| aftertv_grille | 6 % | 1.1 ms |
| aftertv_sections (from sound) | 3 % | 0.6 ms |
| aftertv_oreille without fine listening | 18 % | 3.0 ms |
| aftertv_oreille with fine listening | 47 % | 7.8 ms |

TouchDesigner runs Python on its main thread. In a heavy network, keep `Fine` off, or run the ear in the OSC program.

## Status

The bricks are tested frame by frame, the way TouchDesigner slices audio, on a constructed track (`touchdesigner/tests`). The full ear is checked to give the same verdicts as the web page. The bridge to TouchDesigner itself (`construit.py`, `aftertv_td/td.py`) is tested against a stand-in for the TouchDesigner API. Run the build line above once in your own TouchDesigner, and check the Textport for any failed step.

Tuned for kick-driven dance music (house, techno), like the rest of After TV.
