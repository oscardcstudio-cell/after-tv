import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from nettoie import nettoie_textes, nettoie_py

def test_js_css_html_sans_commentaires_mais_avec_le_code():
    r = nettoie_textes({'a.js': '// Rien, 2026-11-14 : note\nexport const x = 1; /* bloc */\nconst y = await Promise.resolve(2);\n', 'b.css': '/* note */\n.a { color: red; }\n', 'c.html': '<!-- note -->\n<p>ok</p>\n<script>// note\nvar z = 3;</script>\n<script type="module">// note\nimport { x } from \'./a.js\';\nconsole.log(x);</script>\n<script type="application/json">{"a": 1}</script>\n<style>/* s */ p { margin: 0 }</style>\n'})
    assert 'Rien' not in r['a.js'] and 'x=1' in r['a.js'] and ('export' in r['a.js']) and ('await' in r['a.js'])
    assert 'note' not in r['b.css'] and 'color:red' in r['b.css']
    h = r['c.html']
    assert 'note' not in h and '<!--' not in h and ('/* s */' not in h)
    assert 'var z=3' in h and 'from"./a.js"' in h and ('{"a": 1}' in h) and ('<p>ok</p>' in h)

def test_python_sans_commentaires_ni_docstrings():
    src = '"""Module : Rien, 2026."""\n# note\ndef f(a):\n    """doc"""\n    return a + 1  # fin\n\nclass C:\n    """seul"""\n'
    out = nettoie_py(src)
    assert 'Rien' not in out and 'note' not in out and ('doc' not in out) and ('seul' not in out)
    ns = {}
    exec(out, ns)
    assert ns['f'](1) == 2
