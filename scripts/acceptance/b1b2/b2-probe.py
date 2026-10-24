"""B2 isolated loopback transport probe. No database; synthetic credentials only."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import json, time, socket, argparse, tempfile, urllib.request, hashlib, os, shutil
SOURCE=Path(__file__).parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--module-url',default='http://localhost:5173/src/lib/request.ts')
parser.add_argument('--port',type=int,default=18763)
args=parser.parse_args()
u=urlparse(args.module_url)
assert u.scheme=='http' and u.hostname in ['localhost','127.0.0.1'] and u.path=='/src/lib/request.ts' and not u.username and not u.query
ROOT=Path(tempfile.mkdtemp(prefix='mes-b2-probe-'))
module=urllib.request.urlopen(args.module_url,timeout=10).read().decode().split('//# sourceMappingURL=')[0]
assert not any(line.startswith('import ') for line in module.splitlines()), 'Inspect module dependencies before probing'
(ROOT/'request.js').write_text(module)
for src,dest in [('b2-suite.js','suite.js'),('b2-index.html','index.html')]:shutil.copyfile(SOURCE/src,ROOT/dest)
metadata={'pid':os.getpid(),'origin':'http://127.0.0.1:'+str(args.port),'moduleUrl':args.module_url,'compiledModuleSha256':hashlib.sha256(module.encode()).hexdigest(),'syntheticOnly':True,'databaseConnection':False}
(ROOT/'metadata.json').write_text(json.dumps(metadata,indent=2))
print(json.dumps({**metadata,'evidenceDirectory':str(ROOT)}),flush=True)
class Handler(BaseHTTPRequestHandler):
 protocol_version='HTTP/1.1'
 def log_message(self,*args): pass
 def do_POST(self):
  if self.path!='/results': self.send_error(404);return
  value=self.rfile.read(int(self.headers.get('Content-Length','0')))
  json.loads(value);(ROOT/'results.json').write_bytes(value)
  self.send_response(204);self.send_header('Content-Length','0');self.end_headers()
 def do_GET(self):
  p=urlparse(self.path);q={k:v[0] for k,v in parse_qs(p.query).items()}
  if not p.path.startswith('/api/'):
   file=ROOT/('index.html' if p.path=='/' else p.path.lstrip('/'))
   if file.resolve().parent!=ROOT.resolve() or file.name not in ['index.html','request.js','suite.js'] or not file.exists():self.send_error(404);return
   b=file.read_bytes();self.send_response(200);self.send_header('Content-Type','text/html' if file.suffix=='.html' else 'application/javascript');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b);return
  assert self.headers.get('Authorization','') in ['', 'Bearer synthetic-a','Bearer synthetic-b']
  started=time.time();rid='probe-'+q.get('id','unknown')
  with (ROOT/'network.jsonl').open('a') as f:f.write(json.dumps({'path':self.path,'at':started,'synthetic':True})+'\n')
  time.sleep(float(q.get('head','0')))
  status=int(q.get('status','200'));body=json.dumps({'errorCode':q.get('code','PROBE_ERROR'),'ok':True,'requestId':rid}).encode()
  self.send_response(status);self.send_header('X-Request-Id',rid)
  self.send_header('Content-Type','text/event-stream' if q.get('sse') else 'application/json')
  empty=q.get('empty') or status==204
  self.send_header('Content-Length',str(0 if empty else 100000 if q.get('sse') else len(body)))
  self.end_headers();self.wfile.flush()
  if empty:return
  try:
   self.wfile.write(b'data: {"ok":true}\n\n' if q.get('sse') and status==200 else body[:1]);self.wfile.flush()
   time.sleep(float(q.get('body','0')))
   if q.get('cut'):
    self.close_connection=True;self.connection.shutdown(socket.SHUT_RDWR);return
   self.wfile.write(body[1:]);self.wfile.flush()
  except (BrokenPipeError,ConnectionResetError,OSError):pass
server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
