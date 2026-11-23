#!/usr/bin/env python3
# Web-Build auf Vercel hochladen: python3 scripts/deploy-vercel.py dist-vercel dienstplan-abteilung
# Build vorher: EXPO_PUBLIC_INVITE_ONLY=1 npx expo export -p web --output-dir dist-vercel
# Token: Authorization-Header für api.vercel.com (hier vom Proxy gesetzt, sonst VERCEL_TOKEN eintragen).
import hashlib, json, os, sys, urllib.request
root, name = sys.argv[1], sys.argv[2]
API = 'https://api.vercel.com'
H = {'Authorization': 'Bearer ' + os.environ.get('VERCEL_TOKEN', 'proxy-injected'), 'User-Agent': 'deploy-script'}
def call(method, path, body=None, headers=None, raw=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = dict(H, **(headers or {}))
    if body is not None: h['Content-Type'] = 'application/json'
    req = urllib.request.Request(API + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=300) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:1500]
files = []
extra = {'vercel.json': json.dumps({'rewrites': [{'source': '/(.*)', 'destination': '/index.html'}],
  'headers': [{'source': '/_expo/(.*)', 'headers': [{'key': 'Cache-Control', 'value': 'public, max-age=31536000, immutable'}]}]}).encode()}
items = []
for d, _, fs in os.walk(root):
    for f in fs:
        p = os.path.join(d, f); items.append((os.path.relpath(p, root), open(p, 'rb').read()))
items += list(extra.items())
for rel, b in items:
    sha = hashlib.sha1(b).hexdigest()
    st, res = call('POST', '/v2/files', raw=b, headers={'x-vercel-digest': sha, 'Content-Type': 'application/octet-stream', 'Content-Length': str(len(b))})
    if st not in (200, 201): print('upload', rel, st, res); sys.exit(1)
    files.append({'file': rel, 'sha': sha, 'size': len(b)})
st, res = call('POST', '/v13/deployments?skipAutoDetectionConfirmation=1', {
    'name': name, 'files': files, 'target': 'production',
    'projectSettings': {'framework': None, 'buildCommand': None, 'installCommand': None, 'outputDirectory': None}})
print(st, json.dumps({k: res.get(k) for k in ('id', 'url', 'readyState', 'alias')} if isinstance(res, dict) else res))
