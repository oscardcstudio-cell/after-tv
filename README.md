# After TV

After TV is a web page that edits video loops live, in sync with the music it hears. It listens to your computer's sound, to a radio stream (Intergalactic FM) or to your microphone. It finds the tempo, the kick and the structure of the track, then decides which loop comes next and when to cut. Nobody touches a fader.

- Live: https://odcstudio.fr/after-tv/
- How it decides, step by step: https://odcstudio.fr/after-tv/how-it-works.html (this page follows the After TV tab open next to it, in real time)

A project by VJ Rien.

## Break and drop detection

When the kick disappears from the music, After TV recognises a break. When it comes back, it recognises a drop. The detection runs live, beat by beat, in the browser, with no server and no pre-analysis of the track. The code is `scripts/beatgrid/kick.py`, `sections.py` and `structure.py`: plain Python with numpy only, and it also runs under Pyodide in the page.

- `kick.py` finds the kick from the energy of the 30 to 120 Hz band, with an adaptive threshold and a dead time.
- `sections.py` (class `DetecteurTemps`) reads break or drop beat by beat, from the level of the bass compared with the median of the current section. The kick confirms it. A clear step of 10 dB or more across two beats, with the kick agreeing (absent for a break, present for a drop), switches after two beats. A weaker step, or a kick that disagrees, takes two bars. Right after a switch, the detector waits three bars.
- A rising drop that never reaches the previous drop's level is a build-up, and it waits up to four bars. A short dip inside a drop (the DJ cuts the kick for a few bars) is a "suspension": what follows is the drop coming back, not a break. The page also displays a prediction of what comes next and in how many bars, but that prediction never triggers anything.
- `structure.py` goes one step further and names the part of the track: intro, verse, build, chorus, break, outro. "Verse" and "chorus" mean less full and fuller, not vocals. A part lasts at least 4 bars. On 11 minutes of real PC sound, it found 8 of the 10 section boundaries of an offline reference within 4 bars (39 of 53 across five test tracks).

The detected section drives the edit: breaks, drops and suspensions each get their own pool of loops (the roles in `tags.json`).

No open-source real-time drop detector turned up when this was built, because the published work is offline. This one is built for house and techno. Its limit is clear: it is tuned for kick-driven dance music, and it errs most on intros where the kick comes and goes.

## TouchDesigner

The listening and the editor also come as TouchDesigner bricks, in `touchdesigner/`. There are five: kick, a beat grid locked on the kick, break/drop, the full ear (song parts, phrase, drop countdown, fine listening) and the editor. Each one does what TouchDesigner has no native operator for, and plugs into native ones (Audio Device In, Beat CHOP, Ableton Link, `audioAnalysis`, Movie File In). You can also run the ear in its own process and receive it over OSC. See `touchdesigner/README.md`.

## What it does

- **Listens in the browser.** Tempo, kick, song structure (intro, verse, build, chorus, break, outro) and voice versus instruments are computed on your machine. The analysis modules are Python, run by Pyodide (`scripts/beatgrid`), with a JavaScript engine on top (`aftertv/site/moteur.js`, `aftertv/site/montage.js`).
- **Cuts by numbered rules.** Every editing rule has a number and sits in plain text in `aftertv/site/regles_montage.json`. You can read why a cut happened, and you can change the rule.
- **Names the track.** Shazam (through `shazamio-core`) recognises the title first, and AudD takes over when Shazam finds nothing.
- **Gives every visitor their own session.** The page never depends on a central machine. Each visitor hears their own sound and gets their own edit.

The loops of the online demo are not in this repository, and they are not free to use. The repository ships 8 example loops of its own (see below), and you can bring yours.

## What is in the repository

| Path | What it holds |
|---|---|
| `aftertv/site` | The page: `index.html`, the interface, the engine, `how-it-works`, the tests (`*.test.mjs`) and the recorded demos in `demos/`. |
| `aftertv/relais` | An optional Cloudflare Worker with a Durable Object. It relays one dashboard to many spectators. |
| `scripts/beatgrid` | The analysis modules the page loads. |
| `scripts/aftertv` | The tooling: `tagueur.py`, `prepare.py`, `deploie.py`, `nettoie.py`, `reconnait.py`, `noms_publics.py`, `audience.py`, `ajoute_demo.mjs`, `enregistre_demo.mjs`, and their tests. |
| `examples` | 8 example loops (`examples/loops/`) and the `examples/tags.json` that describes them. |
| `docs/glitch` | The optional VHS look, with `ntsc.wasm` (see Credits). |

The published code has had its comments removed.

## Make your own

You need Python 3.12+, Node 22+, `ffmpeg` on your path, and a Cloudflare account.

**Quick path, with the example loops.** Skip step 1 and run:

```
python scripts/aftertv/prepare.py --tags examples/tags.json --racine examples/loops --out build
```

Then upload `build` and deploy (steps 3 and 4). The 8 example loops are short abstract 3D motion-graphics pieces (8 s each, 720p, no sound, about 11 MB in total). They were made by the project's author and are released with the code under the MIT license.

**1. Tag your loops.**

```
python scripts/aftertv/tagueur.py <folder of loops> [--tags tags.json] [--port 8770]
```

The tagger opens a local page, reachable from 127.0.0.1 only. It reads a plain folder of videos (sub-folders are fine, Resolume is not needed). Each loop plays when you hover it. You set its mood (house, techno or both), its roles (drop, break, suspension, hyper), its speed (slow, normal, fast), and the flags one shot and NSFW. Every click saves at once into `tags.json`, which defaults to `<folder>/tags.json`. The paths in that file are relative to the folder, and the name of the first sub-folder becomes the loop's theme. NSFW loops stay out of the published manifest unless you run `prepare.py --avec-nsfw`.

You can also write `tags.json` by hand. The format is readable in `scripts/beatgrid/etiquettes.py` and `scripts/aftertv/prepare.py`.

**2. Prepare the loops for the web.** For your own loops, point `--tags` and `--racine` at your folder:

```
python scripts/aftertv/prepare.py --tags <folder>/tags.json --racine <folder> --out build [--limite N] [--a-blanc]
```

Each loop becomes a 720p H.264 MP4 without sound, plus a thumbnail. The script writes a `manifest.json` next to them. It skips what is already encoded, so you can stop it and run it again. `--limite N` encodes only N new loops, and `--a-blanc` lists what would happen without writing anything.

**3. Upload the output folder to a Cloudflare R2 bucket.** Use `rclone` or `wrangler`. This version does not script that step.

**4. Deploy.**

```
python scripts/aftertv/deploie.py --etapes bucket,relais,page
```

The script creates the bucket, deploys the relay Worker and publishes the page on Cloudflare Pages. It reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the environment, and it needs Node (`npx`, `wrangler`).

## Tests

```
node --test aftertv/site/*.test.mjs scripts/aftertv/*.test.mjs
python -m pytest scripts
```

## What is not here yet

This is a first cut of the code, not a kit that installs in one command.

- **The tagger is a first version.** It makes no automatic visual tags yet, and it has no keyboard shortcuts.
- **No single command.** There is no `after-tv init`. You run the four steps above one by one.
- **Untested on a clean machine.** The scripts have not been run on a fresh Windows or Mac install.
- **No live dashboard.** The project's own control surface (Resolume, game controller) stays out of this repository.
- **Placeholder radio logos.** The three radio logos are grey squares. Replace them in `aftertv/site/radios/` (`cbs.png`, `disco-fetish.png`, `tdm.png`) with the stations' own artwork, or change the list in `radio.js`.
- **Title recognition goes through the project's hosted service.** The AudD key stays on the server side. If you host your own copy, you will want to plug in your own Worker.

## Credits

### Libraries it uses

The page loads these libraries from a CDN at run time. The repository does not redistribute them.

- [Pyodide](https://pyodide.org) 0.27.7 runs the Python analysis in the browser.
- [live-audio-analyzer](https://github.com/hssnadr/live-audio-analyzer) by hssnadr does the audio analysis. The page loads it from its own repository, and this repository holds no copy.
- [shazamio-core](https://github.com/shazamio/shazamio-core) 1.3.1 does the Shazam recognition, through shazamio. [AudD](https://audd.io) is the fallback service.
- [MediaPipe](https://ai.google.dev/edge/mediapipe) tasks-audio 1.2.3 runs YAMNet for voice and instrument detection.

One library does ship in the repository. [ntsc-rs](https://github.com/ntsc-rs/ntsc-rs) (MIT OR ISC OR Apache-2.0), compiled to WebAssembly as `docs/glitch/ntsc.wasm`, drives the optional VHS look.

The build-time tools are esbuild, Prettier and Wrangler.

### Work that shaped the break and drop detector

The detector is written in-house, and no code was copied from the projects below. The project read, tried or benchmarked them, and they shaped the design.

- Yadati et al., ["Detecting Drops in Electronic Dance Music"](https://archives.ismir.net/ismir2014/paper/000297.pdf) (ISMIR 2014): a drop lands at the top of a build-up.
- A [TU Delft thesis on EDM breaks](https://repository.tudelft.nl/file/File_c9443975-b44e-4a36-bf92-a2f6f02041eb): a break is recognised by the kick being removed.
- Vande Veire and De Bie, [2018](https://asmp-eurasipjournals.springeropen.com/articles/10.1186/s13636-018-0134-8), on EDM structure and phrase lengths (4, 8, 16, 32 bars).
- [felixmeyer6/drop-detector](https://github.com/felixmeyer6/drop-detector) is offline. It gave the idea of aligning switches to phrases of 4, 8, 16 and 32 bars.
- [Lancito01/kickstep](https://github.com/Lancito01/kickstep) is a kick detector, used as a second opinion on the kick.
- [madmom](https://github.com/CPJKU/madmom), [aubio](https://github.com/aubio/aubio), [ADTOF](https://github.com/MZehren/ADTOF), [BeatNet](https://github.com/mjhydri/BeatNet), BEAST, [BTrack](https://github.com/adamstark/BTrack) and [beat_this](https://github.com/CPJKU/beat_this) were tried or read for beat and kick tracking. None beat the in-house kick detector on the test bench, so none is used.
- [MSAF](https://github.com/urinieto/msaf) and the Foote novelty method (song structure), [all-in-one](https://github.com/mir-aidj/all-in-one) and [SongFormer](https://github.com/ASLP-lab/SongFormer) (offline section labelling) were read and not used, because they are offline.
- [Beat Link Trigger](https://github.com/Deep-Symmetry/beat-link-trigger) (Deep Symmetry) is the one exact source of phrase boundaries, from Pioneer players. It needs CDJs, so it is not used.

If a credit is missing or wrong, open an issue and it will be fixed.

## License

MIT. See `LICENSE`.
