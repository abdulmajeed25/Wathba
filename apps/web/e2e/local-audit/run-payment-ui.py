from pathlib import Path
import os, socket, subprocess, sys, time

root=Path.cwd()
(root/'.cache/audit').mkdir(parents=True,exist_ok=True)
with socket.socket() as probe:
 try:
  probe.bind(('127.0.0.1',3003))
 except OSError:
  raise RuntimeError('Test port occupied; refusing to reuse an unknown server')
env=dict(os.environ,NEXT_PUBLIC_API_URL='http://127.0.0.1:4000',WATHBA_BUILD_MODE='server')
with (root/'.cache/audit/payment-ui-server.log').open('w',encoding='utf8') as log:
 server=subprocess.Popen(['node',str(root/'apps/web/node_modules/next/dist/bin/next'),'start','-p','3003','-H','127.0.0.1'],
  cwd=root/'apps/web',env=env,stdout=log,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
 try:
  for _ in range(120):
   if server.poll() is not None:raise RuntimeError('Next exited; inspect payment-ui-server.log')
   try:
    with socket.create_connection(('127.0.0.1',3003),timeout=.5):break
   except OSError:time.sleep(.25)
  else:raise RuntimeError('Next startup timeout')
  for script in (sys.argv[1:] or ['test-idempotency-ui.py','test-pending-return-ui.py','test-shipping-ui.py','test-checkout-policy-ui.py']):
   subprocess.run([sys.executable,'-u',str(Path(__file__).parent/script)],cwd=root,env=env,check=True)
 finally:
  server.terminate()
  try:server.wait(timeout=10)
  except subprocess.TimeoutExpired:server.kill();server.wait()
