# After TV

After TV is a web page that cuts video loops live, on the music it hears. It listens to your computer's sound, to a radio stream (Intergalactic FM) or to your microphone. It finds the tempo, the kick and the structure of the track, then decides which loop comes next and when to cut. Nobody touches a fader.

- Live: https://odcstudio.fr/after-tv/
- How it decides, step by step: https://odcstudio.fr/after-tv/how-it-works.html (this page follows the After TV tab open next to it, in real time)

A project by VJ Rien.

## What it does

- **Listens in the browser.** Tempo, kick, song structure (intro, verse, build, chorus, break, outro) and voice versus instruments are computed on your machine. The analysis modules are Python, run by Pyodide (`scripts/beatgrid`), with a JavaScript engine on top (`aftertv/site/moteur.js`, `aftertv/site/montage.js`).
- **Cuts by numbered rules.** Every editing rule has a number and sits in plain text in `aftertv/site/regles_montage.json`. You can read why a cut happened, and you can change the rule.
- **Names the track.** Shazam (through `shazamio-core`) recognises the title first, and AudD takes over when Shazam finds nothing.
- **Gives every visitor their own session.** The page never depends on a central machine. Each visitor hears their own sound and gets their own edit.

The loops of the online demo are not in this repository, and they are not free to use. You bring your own.

## What is in the repository

| Path | What it holds |
|---|---|
| `aftertv/site` | The page: `index.html`, the interface, the engine, `how-it-works`, the tests (`*.test.mjs`) and the recorded demos in `demos/`. |
| `aftertv/relais` | An optional Cloudflare Worker with a Durable Object. It relays one dashboard to many spectators. |
| `scripts/beatgrid` | The analysis modules the page loads. |
| `scripts/aftertv` | The tooling: `prepare.py`, `deploie.py`, `nettoie.py`, `reconnait.py`, `noms_publics.py`, `audience.py`, `ajoute_demo.mjs`, `enregistre_demo.mjs`, and their tests. |

The published code has had its comments removed.

## Make your own

You need Python 3.12+, Node 22+, `ffmpeg` on your path, and a Cloudflare account.

**1. Describe your loops.** Write a `tags.json` that lists each loop with its mood (house or techno), its roles (break, drop, suspension, hyper), its speed and the rest. There is no tool for this yet (see below). The format is readable in `scripts/beatgrid/etiquettes.py` and `scripts/aftertv/prepare.py`.

**2. Prepare the loops for the web.**

```
python scripts/aftertv/prepare.py --tags tags.json --racine <folder of your loops> --out <output folder> [--limite N] [--a-blanc]
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

- **No tagging tool.** The tool that tags the project's own loops is tied to a Resolume setup and is not published. A public tool that reads a plain folder of videos is planned. Until it exists, you write `tags.json` by hand.
- **No example loops.** The repository holds no video.
- **No single command.** There is no `after-tv init`. You run the four steps above one by one.
- **Untested on a clean machine.** The scripts have not been run on a fresh Windows or Mac install.
- **No live dashboard.** The project's own control surface (Resolume, game controller) stays out of this repository.
- **Placeholder radio logos.** The three radio logos are grey squares. Replace them in `aftertv/site/radios/` (`cbs.png`, `disco-fetish.png`, `tdm.png`) with the stations' own artwork, or change the list in `radio.js`.
- **Title recognition goes through the project's hosted service.** The AudD key stays on the server side. If you host your own copy, you will want to plug in your own Worker.

## Credits

The page loads these libraries from a CDN at run time. The repository does not redistribute them.

- [Pyodide](https://pyodide.org) 0.27.7, which runs the Python analysis in the browser
- [live-audio-analyzer](https://github.com/hssnadr) by hssnadr
- [shazamio-core](https://github.com/shazamio/shazamio-core) 1.3.1, for track recognition
- [MediaPipe](https://ai.google.dev/edge/mediapipe) tasks-audio 1.2.3, which runs YAMNet for voice and instrument detection

## License

MIT. See `LICENSE`.
