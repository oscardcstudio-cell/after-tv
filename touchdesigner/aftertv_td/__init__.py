import os
import sys
RACINE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
for _sous in ('scripts/beatgrid', 'scripts/aftertv'):
    _p = os.path.join(RACINE, *_sous.split('/'))
    if os.path.isdir(_p) and _p not in sys.path:
        sys.path.insert(0, _p)
