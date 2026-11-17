import ast
import os
import re
import shutil
import subprocess
import sys
import tempfile
ESBUILD = 'esbuild@0.28.2'

def _esbuild_lot(morceaux: list[tuple[str, str, bool]]) -> list[str]:
    if not morceaux:
        return []
    npx = shutil.which('npx') or shutil.which('npx.cmd')
    if not npx:
        raise RuntimeError('npx introuvable : il faut Node pour nettoyer le code publié')
    sortie = [None] * len(morceaux)
    with tempfile.TemporaryDirectory() as tmp:
        groupes = {}
        for i, (src, loader, module) in enumerate(morceaux):
            ext = {'css': '.css'}.get(loader, '.mjs' if module else '.js')
            nom = os.path.join(tmp, 'in', f'm{i}{ext}')
            os.makedirs(os.path.dirname(nom), exist_ok=True)
            with open(nom, 'w', encoding='utf-8', newline='\n') as fh:
                fh.write(src)
            groupes.setdefault((loader, module), []).append((i, nom))
        for (loader, module), fichiers in groupes.items():
            out = os.path.join(tmp, f'out-{loader}-{int(module)}')
            args = [npx, '--yes', ESBUILD, *[n for _, n in fichiers], f'--outdir={out}', '--legal-comments=none', '--charset=utf8', '--log-level=error', '--minify-whitespace']
            if loader == 'js':
                args += ['--target=esnext'] + (['--format=esm'] if module else [])
            r = subprocess.run(args, capture_output=True)
            if r.returncode:
                raise RuntimeError(r.stderr.decode('utf-8', 'replace'))
            for i, nom in fichiers:
                base = os.path.splitext(os.path.basename(nom))[0]
                with open(os.path.join(out, base + ('.css' if loader == 'css' else '.js')), encoding='utf-8') as fh:
                    sortie[i] = fh.read()
    return sortie
SCRIPT = re.compile('(<script\\b[^>]*>)(.*?)(</script>)', re.S | re.I)
STYLE = re.compile('(<style\\b[^>]*>)(.*?)(</style>)', re.S | re.I)
COMMENTAIRE_HTML = re.compile('<!--.*?-->', re.S)

def _decoupe_html(source: str):
    blocs, travail = ([], [])

    def garde(m, loader):
        ouvre, corps, ferme = m.groups()
        idx = None
        if corps.strip():
            if loader == 'js' and re.search('type\\s*=\\s*[\\"\'](?!module|text/javascript)', ouvre, re.I):
                pass
            else:
                idx = len(travail)
                travail.append((corps, loader, loader == 'js' and 'module' in ouvre.lower()))
        blocs.append((ouvre, corps, ferme, idx))
        return f'\x00{len(blocs) - 1}\x00'
    s = SCRIPT.sub(lambda m: garde(m, 'js'), source)
    s = STYLE.sub(lambda m: garde(m, 'css'), s)
    s = COMMENTAIRE_HTML.sub('', s)
    return (s, blocs, travail)

def _recolle_html(s: str, blocs, nettoyes) -> str:

    def remet(m):
        ouvre, corps, ferme, idx = blocs[int(m.group(1))]
        return ouvre + ('\n' + nettoyes[idx] if idx is not None else corps) + ferme
    return re.sub('\\0(\\d+)\\0', remet, s)

def nettoie_py(source: str) -> str:
    arbre = ast.parse(source)
    for noeud in ast.walk(arbre):
        corps = getattr(noeud, 'body', None)
        if isinstance(noeud, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and corps:
            if isinstance(corps[0], ast.Expr) and isinstance(getattr(corps[0], 'value', None), ast.Constant) and isinstance(corps[0].value.value, str):
                corps.pop(0)
                if not corps:
                    corps.append(ast.Pass())
    return ast.unparse(arbre) + '\n'

def nettoie_textes(textes: dict[str, str]) -> dict[str, str]:
    travail, plan, res = ([], {}, {})
    for nom, src in textes.items():
        ext = os.path.splitext(nom)[1].lower()
        if ext in ('.js', '.mjs'):
            plan[nom] = ('brut', len(travail))
            travail.append((src, 'js', True))
        elif ext == '.css':
            plan[nom] = ('brut', len(travail))
            travail.append((src, 'css', False))
        elif ext == '.html':
            s, blocs, morceaux = _decoupe_html(src)
            plan[nom] = ('html', (s, blocs, len(travail), len(morceaux)))
            travail += morceaux
        elif ext == '.py':
            res[nom] = nettoie_py(src)
    nets = _esbuild_lot(travail)
    for nom, (sorte, info) in plan.items():
        if sorte == 'brut':
            res[nom] = nets[info]
        else:
            s, blocs, debut, n = info
            res[nom] = _recolle_html(s, blocs, nets[debut:debut + n])
    return res

def nettoie_dossier(dossier: str) -> list[str]:
    textes = {}
    for racine, _, fichiers in os.walk(dossier):
        for f in fichiers:
            if os.path.splitext(f)[1].lower() in ('.js', '.mjs', '.css', '.html', '.py'):
                chemin = os.path.join(racine, f)
                with open(chemin, encoding='utf-8') as fh:
                    textes[chemin] = fh.read()
    faits = []
    for chemin, apres in nettoie_textes(textes).items():
        if apres != textes[chemin]:
            with open(chemin, 'w', encoding='utf-8', newline='\n') as fh:
                fh.write(apres)
            faits.append(os.path.relpath(chemin, dossier))
    return sorted(faits)
if __name__ == '__main__':
    for f in nettoie_dossier(sys.argv[1]):
        print('nettoyé :', f)
