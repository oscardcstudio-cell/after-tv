import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
API = 'https://api.cloudflare.com/client/v4'

def requete(jours):
    jours = int(str(jours)) if str(jours).isdigit() else None
    if not jours or not 0 < jours <= 90:
        raise ValueError('jours : un entier entre 1 et 90')
    return f"SELECT blob1 AS visite, blob2 AS source, blob3 AS style, blob4 AS pays, sum(_sample_interval * double1) AS minutes FROM aftertv_audience WHERE timestamp > NOW() - INTERVAL '{jours}' DAY GROUP BY visite, source, style, pays FORMAT JSON"

def _compte(lignes, cle, visites=True):
    vus, n = (set(), {})
    for l in lignes:
        v = l.get(cle) or '?'
        if visites:
            if (l['visite'], v) in vus:
                continue
            vus.add((l['visite'], v))
        n[v] = n.get(v, 0) + 1
    return dict(sorted(n.items(), key=lambda kv: -kv[1]))

def resume(lignes):
    minutes = sum((float(l.get('minutes') or 0) for l in lignes))
    return {'visites': len({l['visite'] for l in lignes}), 'heures': round(minutes / 60, 2), 'pays': _compte(lignes, 'pays'), 'sources': _compte(lignes, 'source'), 'styles': _compte(lignes, 'style')}

def affiche(r, jours):

    def liste(d):
        return ', '.join((f'{k} {v}' for k, v in d.items())) or 'aucun'
    return '\n'.join([f'After TV, {jours} dernier(s) jour(s)', f"  visites : {r['visites']}", f"  heures regardées : {r['heures']}", f"  pays : {liste(r['pays'])}", f"  sources : {liste(r['sources'])}", f"  styles : {liste(r['styles'])} (une visite peut compter dans plusieurs styles)"])

def _poste(url, corps, token):
    req = urllib.request.Request(url, data=corps.encode(), method='POST', headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

def interroge(jours, token, compte, poste=_poste):
    url = f'{API}/accounts/{compte}/analytics_engine/sql'
    return json.loads(poste(url, requete(jours), token))['data']

def _variable(nom):
    v = os.environ.get(nom)
    if v or sys.platform != 'win32':
        return v
    try:
        r = subprocess.run(['powershell', '-NoProfile', '-Command', f'[Environment]::GetEnvironmentVariable("{nom}","User")'], capture_output=True, text=True, timeout=20)
        return r.stdout.strip() or None
    except Exception:
        return None

def _compte_id(token):
    c = _variable('CLOUDFLARE_ACCOUNT_ID')
    if c:
        return c
    req = urllib.request.Request(f'{API}/accounts', headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req, timeout=30) as r:
        comptes = json.loads(r.read())['result']
    if len(comptes) != 1:
        raise SystemExit('Plusieurs comptes Cloudflare : définir CLOUDFLARE_ACCOUNT_ID.')
    return comptes[0]['id']

def main(argv=None):
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    p = argparse.ArgumentParser(description='After TV')
    p.add_argument('--jours', type=int, default=7)
    a = p.parse_args(argv)
    token = _variable('CLOUDFLARE_API_TOKEN')
    if not token:
        raise SystemExit('CLOUDFLARE_API_TOKEN absent.')
    try:
        lignes = interroge(a.jours, token, _compte_id(token))
    except urllib.error.HTTPError as e:
        corps = e.read().decode(errors='replace')[:300]
        aide = " Le token n'a probablement pas le droit « Account Analytics : Read » : à ajouter dans le tableau de bord Cloudflare." if e.code in (401, 403) else ''
        raise SystemExit(f'Cloudflare a répondu {e.code}.{aide}\n{corps}')
    print(affiche(resume(lignes), a.jours))
if __name__ == '__main__':
    main()
