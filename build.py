"""Fabrique les deux versions de l'extension à partir du dossier src/ :
  dist/wikimasters-vente-<version>-chrome-brave-edge/  et  dist/wikimasters-vente-<version>-firefox/
  (+ un zip pour chacune, avec la version dans le nom, copié dans telechargements/)
Usage : python3 build.py
"""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / 'src'
DIST = ROOT / 'dist'
VERSION = '1.7.1'

base = {
    'manifest_version': 3,
    'name': 'WikiMasters Vente',
    'version': VERSION,
    'description': "Non officiel : notifications plus claires (enchères terminées grisées) et panneau de prix et de priorités de vente pour WikiMasters.",
    'icons': {'16': 'icon16.png', '48': 'icon48.png', '128': 'icon128.png'},
    # unlimitedStorage : les grosses collections dépassent vite 10 Mo
    'permissions': ['storage', 'unlimitedStorage'],
    # l'extension ne parle qu'au site WikiMasters (elle lit la page, elle n'envoie rien)
    'host_permissions': ['https://www.wiki-masters.com/*', 'https://wiki-masters.com/*'],
    'options_ui': {'page': 'options.html', 'open_in_tab': True},
    'action': {'default_title': 'WikiMasters Vente — réglages', 'default_icon': {'16': 'icon16.png', '48': 'icon48.png'}},
    'content_scripts': [{
        'matches': ['https://www.wiki-masters.com/*', 'https://wiki-masters.com/*'],
        'js': ['content.js'],
        'css': ['style.css'],
        'run_at': 'document_idle',
    }],
}

chrome = dict(base)
chrome['background'] = {'service_worker': 'background.js'}

firefox = dict(base)
firefox['background'] = {'scripts': ['background.js']}
firefox['browser_specific_settings'] = {
    'gecko': {
        'id': 'wikimasters-vente@francois',
        'strict_min_version': '142.0',
        # l'extension ne collecte aucune donnée
        'data_collection_permissions': {'required': ['none']},
    },
}

DIST.mkdir(exist_ok=True)
DL = ROOT / 'telechargements'
DL.mkdir(exist_ok=True)
# on enlève les anciens zips : il ne reste que la version en cours
for old in DL.glob('wikimasters-vente*.zip'):
    old.unlink()
for name, manifest in [('chrome-brave-edge', chrome), ('firefox', firefox)]:
    label = f'wikimasters-vente-{VERSION}-{name}'   # ex. wikimasters-vente-1.2.0-firefox
    for d in DIST.glob(f'wikimasters-vente-*-{name}'):
        shutil.rmtree(d, ignore_errors=True)
    shutil.rmtree(DIST / name, ignore_errors=True)
    out = DIST / label
    shutil.copytree(SRC, out)
    (out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    zip_file = shutil.make_archive(str(DIST / label), 'zip', out)  # renvoie le chemin complet du .zip
    shutil.copy(zip_file, DL)
    print('ok', out, '->', Path(zip_file).name)
