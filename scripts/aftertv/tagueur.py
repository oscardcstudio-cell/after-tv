import argparse
import json
import mimetypes
import os
import re
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse
VIDEO = {'.mov', '.mp4', '.avi', '.mkv', '.webm', '.m4v'}
HUMEURS = ('house', 'techno', 'les deux')
ROLES = ('drop', 'break', 'suspension', 'hyper')
VITESSES = ('lent', 'normal', 'rapide')
DEFAUT = {'mood': 'les deux', 'roles': ['drop'], 'vitesse': 'normal', 'one_shot': False, 'nsfw': 0}

def scanne(dossier: str) -> list[str]:
    trouves = []
    for racine, _, noms in os.walk(dossier):
        for n in noms:
            if os.path.splitext(n)[1].lower() in VIDEO:
                trouves.append(os.path.relpath(os.path.join(racine, n), dossier).replace(os.sep, '/'))
    return sorted(trouves, key=str.lower)

def chemin_sur(dossier: str, relatif: str) -> str | None:
    base = os.path.realpath(dossier)
    p = os.path.realpath(os.path.join(base, *relatif.split('/')))
    if os.path.commonpath([base, p]) != base or not os.path.isfile(p):
        return None
    return p

def normalise(tag: dict | None) -> dict:
    tag = tag or {}
    roles = [r for r in ROLES if r in (tag.get('roles') or [])]
    return {'mood': tag.get('mood') if tag.get('mood') in HUMEURS else DEFAUT['mood'], 'roles': roles or list(DEFAUT['roles']), 'vitesse': tag.get('vitesse') if tag.get('vitesse') in VITESSES else DEFAUT['vitesse'], 'one_shot': bool(tag.get('one_shot')), 'nsfw': 1 if tag.get('nsfw') else 0}

def charge(tags_path: str) -> dict:
    try:
        with open(tags_path, encoding='utf-8') as fh:
            d = json.load(fh)
    except (OSError, ValueError):
        d = {}
    if not isinstance(d.get('clips'), dict):
        d['clips'] = {}
    return d

def ecrit(tags_path: str, data: dict) -> None:
    tmp = tags_path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, tags_path)

def pose(tags_path: str, relatif: str, tag: dict) -> dict:
    d = charge(tags_path)
    ancien = d['clips'].get(relatif, {})
    nouveau = {**ancien, 'name': ancien.get('name') or os.path.splitext(os.path.basename(relatif))[0], **normalise(tag)}
    d['clips'][relatif] = nouveau
    ecrit(tags_path, d)
    return nouveau

def liste(dossier: str, tags_path: str) -> list[dict]:
    clips = charge(tags_path)['clips']
    return [{'path': p, 'name': os.path.splitext(os.path.basename(p))[0], 'tag': normalise(clips.get(p)), 'pose': p in clips} for p in scanne(dossier)]
PAGE = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<title>After TV tagger</title>\n<style>\n:root{color-scheme:dark;--bg:#0b0b0b;--fg:#ededed;--mut:#8a8a8a;--line:#262626;--on:#ededed}\n*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,sans-serif}\nheader{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}\nheader b{letter-spacing:.08em}.mut{color:var(--mut)}\nselect,input[type=search]{background:#141414;color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;font:inherit}\nmain{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;padding:16px}\n.carte{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#101010}\n.carte.pose{border-color:#3a3a3a}\nvideo{display:block;width:100%;aspect-ratio:16/9;background:#000;object-fit:cover}\n.corps{padding:10px 12px;display:grid;gap:8px}.nom{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.rang{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.rang>span.lab{width:62px;color:var(--mut);font-size:12px}\nbutton.p{background:transparent;color:var(--mut);border:1px solid var(--line);border-radius:999px;padding:3px 10px;font:inherit;cursor:pointer}\nbutton.p[aria-pressed=true]{background:var(--on);color:#000;border-color:var(--on)}\nbutton.p:focus-visible{outline:2px solid #fff;outline-offset:2px}\n</style></head><body>\n<header><b>AFTER TV TAGGER</b><span class="mut" id="compte"></span>\n<label>Show <select id="filtre"><option value="tout">all loops</option><option value="neuf">not tagged yet</option><option value="pose">tagged</option></select></label>\n<input id="q" type="search" placeholder="search a name"><span class="mut" id="etat"></span></header>\n<main id="grille"></main>\n<script>\nconst HUMEURS=[\'house\',\'techno\',\'les deux\'],ROLES=[\'drop\',\'break\',\'suspension\',\'hyper\'],VITESSES=[\'lent\',\'normal\',\'rapide\'];\nconst LIB={\'les deux\':\'both\',\'lent\':\'slow\',\'normal\':\'normal\',\'rapide\':\'fast\'};\nlet loops=[];const $=s=>document.querySelector(s);\nconst url=p=>\'/video/\'+p.split(\'/\').map(encodeURIComponent).join(\'/\');\nasync function envoie(l){$(\'#etat\').textContent=\'saving…\';\n const r=await fetch(\'/api/tag\',{method:\'POST\',headers:{\'content-type\':\'application/json\'},body:JSON.stringify({path:l.path,tag:l.tag})});\n if(r.ok){l.pose=true;$(\'#etat\').textContent=\'saved\';}else $(\'#etat\').textContent=\'not saved\';compte();}\nfunction compte(){$(\'#compte\').textContent=loops.filter(l=>l.pose).length+\' / \'+loops.length+\' tagged\';}\nfunction pastille(texte,actif,clic){const b=document.createElement(\'button\');b.className=\'p\';b.type=\'button\';\n b.textContent=texte;b.setAttribute(\'aria-pressed\',actif);b.onclick=()=>{clic();};return b;}\nfunction carte(l){const c=document.createElement(\'div\');c.className=\'carte\'+(l.pose?\' pose\':\'\');\n const v=document.createElement(\'video\');v.src=url(l.path)+\'#t=0.5\';v.muted=true;v.loop=true;v.playsInline=true;v.preload=\'metadata\';\n c.onmouseenter=()=>v.play().catch(()=>{});c.onmouseleave=()=>v.pause();\n const corps=document.createElement(\'div\');corps.className=\'corps\';\n const nom=document.createElement(\'div\');nom.className=\'nom\';nom.textContent=l.name;nom.title=l.path;corps.append(nom);\n const rang=(lab,...bs)=>{const r=document.createElement(\'div\');r.className=\'rang\';const s=document.createElement(\'span\');\n  s.className=\'lab\';s.textContent=lab;r.append(s,...bs);corps.append(r);};\n const dessine=()=>{c.className=\'carte\'+(l.pose?\' pose\':\'\');corps.querySelectorAll(\'.rang\').forEach(r=>r.remove());\n  rang(\'mood\',...HUMEURS.map(h=>pastille(LIB[h]||h,l.tag.mood===h,()=>{l.tag.mood=h;envoie(l);dessine();})));\n  rang(\'roles\',...ROLES.map(r=>pastille(r,l.tag.roles.includes(r),()=>{const s=new Set(l.tag.roles);s.has(r)?s.delete(r):s.add(r);\n   l.tag.roles=ROLES.filter(x=>s.has(x));if(!l.tag.roles.length)l.tag.roles=[\'drop\'];envoie(l);dessine();})));\n  rang(\'speed\',...VITESSES.map(h=>pastille(LIB[h]||h,l.tag.vitesse===h,()=>{l.tag.vitesse=h;envoie(l);dessine();})));\n  rang(\'flags\',pastille(\'one shot\',l.tag.one_shot,()=>{l.tag.one_shot=!l.tag.one_shot;envoie(l);dessine();}),\n   pastille(\'NSFW\',!!l.tag.nsfw,()=>{l.tag.nsfw=l.tag.nsfw?0:1;envoie(l);dessine();}));};\n dessine();c.append(v,corps);return c;}\nfunction montre(){const f=$(\'#filtre\').value,q=$(\'#q\').value.toLowerCase();const g=$(\'#grille\');g.replaceChildren();\n for(const l of loops){if(f===\'neuf\'&&l.pose)continue;if(f===\'pose\'&&!l.pose)continue;\n  if(q&&!l.path.toLowerCase().includes(q))continue;g.append(carte(l));}}\n$(\'#filtre\').onchange=montre;$(\'#q\').oninput=montre;\nfetch(\'/api/clips\').then(r=>r.json()).then(d=>{loops=d;compte();montre();});\n</script></body></html>\n'

def fabrique(dossier: str, tags_path: str):
    verrou = threading.Lock()

    class H(BaseHTTPRequestHandler):

        def log_message(self, *a):
            pass

        def envoie(self, code, corps: bytes, mime='application/json; charset=utf-8', extra=None):
            self.send_response(code)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(corps)))
            self.send_header('Cache-Control', 'no-store')
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(corps)

        def do_GET(self):
            chemin = urlparse(self.path).path
            if chemin == '/':
                return self.envoie(200, PAGE.encode('utf-8'), 'text/html; charset=utf-8')
            if chemin == '/api/clips':
                with verrou:
                    return self.envoie(200, json.dumps(liste(dossier, tags_path), ensure_ascii=False).encode('utf-8'))
            if chemin.startswith('/video/'):
                return self.video(unquote(chemin[len('/video/'):]))
            self.envoie(404, b'{}')
        do_HEAD = do_GET

        def video(self, relatif):
            p = chemin_sur(dossier, relatif)
            if not p or os.path.splitext(p)[1].lower() not in VIDEO:
                return self.envoie(404, b'{}')
            taille = os.path.getsize(p)
            debut, fin = (0, taille - 1)
            m = re.match('bytes=(\\d*)-(\\d*)$', self.headers.get('Range', ''))
            if m and (m.group(1) or m.group(2)):
                if m.group(1):
                    debut = int(m.group(1))
                    fin = int(m.group(2)) if m.group(2) else fin
                else:
                    debut = max(0, taille - int(m.group(2)))
                fin = min(fin, taille - 1)
                if debut > fin:
                    return self.envoie(416, b'{}', extra={'Content-Range': f'bytes */{taille}'})
            partiel = debut != 0 or fin != taille - 1
            self.send_response(206 if partiel else 200)
            self.send_header('Content-Type', mimetypes.guess_type(p)[0] or 'application/octet-stream')
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Content-Length', str(fin - debut + 1))
            if partiel:
                self.send_header('Content-Range', f'bytes {debut}-{fin}/{taille}')
            self.end_headers()
            if self.command == 'HEAD':
                return
            with open(p, 'rb') as fh:
                fh.seek(debut)
                reste = fin - debut + 1
                while reste > 0:
                    bloc = fh.read(min(1 << 20, reste))
                    if not bloc:
                        break
                    try:
                        self.wfile.write(bloc)
                    except (BrokenPipeError, ConnectionResetError):
                        return
                    reste -= len(bloc)

        def do_POST(self):
            if urlparse(self.path).path != '/api/tag':
                return self.envoie(404, b'{}')
            try:
                n = int(self.headers.get('Content-Length') or 0)
                corps = json.loads(self.rfile.read(min(n, 1 << 16)) or b'{}')
                relatif = corps['path']
            except (ValueError, KeyError, TypeError):
                return self.envoie(400, b'{}')
            if not isinstance(relatif, str) or not chemin_sur(dossier, relatif):
                return self.envoie(404, b'{}')
            with verrou:
                ecrit_tag = pose(tags_path, relatif, corps.get('tag') if isinstance(corps.get('tag'), dict) else {})
            self.envoie(200, json.dumps(ecrit_tag, ensure_ascii=False).encode('utf-8'))
    return H

def main(argv=None) -> int:
    p = argparse.ArgumentParser(description='After TV : tagueur ouvert')
    p.add_argument('dossier', help='le dossier des loops (sous-dossiers permis)')
    p.add_argument('--tags', default=None, help='tags.json à lire et à écrire (défaut : <dossier>/tags.json)')
    p.add_argument('--port', type=int, default=8770)
    p.add_argument('--sans-navigateur', action='store_true')
    a = p.parse_args(argv)
    dossier = os.path.abspath(a.dossier)
    if not os.path.isdir(dossier):
        print(f'Dossier introuvable : {dossier}', file=sys.stderr)
        return 1
    tags_path = os.path.abspath(a.tags or os.path.join(dossier, 'tags.json'))
    n = len(scanne(dossier))
    if n == 0:
        print('Aucune vidéo dans ce dossier.', file=sys.stderr)
        return 1
    srv = ThreadingHTTPServer(('127.0.0.1', a.port), fabrique(dossier, tags_path))
    adresse = f'http://127.0.0.1:{a.port}/'
    print(f'{n} loops. Tagueur : {adresse}\nTags écrits dans {tags_path} (Ctrl+C pour finir).')
    if not a.sans_navigateur:
        webbrowser.open(adresse)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0
if __name__ == '__main__':
    sys.exit(main())
