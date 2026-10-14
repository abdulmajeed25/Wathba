import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
from urllib.parse import urlparse, parse_qs
state={'rows': [], 'fail': False}
class Api(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def do_GET(self):
  path=self.path.split('?')[0]; code=200
  if path=='/v1/platform/status': data={'maintenance':False}
  elif path=='/v1/pledges/me/result':
   ref=parse_qs(urlparse(self.path).query).get('paymentRef',[''])[0]
   data=next((r for r in state['rows'] if r['paymentRef']==ref),None)
   code=503 if state['fail'] else (200 if data else 404);data=data or {}
  elif path=='/v1/pledges/me':
   code=503 if state['fail'] else 200; data={'items':state['rows']}
  elif path=='/v1/users/me': data={'id':'ui-test','name':'Test','roles':['BACKER']}
  else: code=404;data={}
  self.send_response(code);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_POST(self): self.send_response(204);self.end_headers()
server=ThreadingHTTPServer(('127.0.0.1',4000),Api)
Thread(target=server.serve_forever,daemon=True).start()
out=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':390,'height':844})
  context.add_cookies([{'name':'wathba_session','value':'ui-fixture-only','url':'http://127.0.0.1:3003'}])
  page=context.new_page()
  cases=[('PENDING_AUTH','pay-self','paid',False,'جارٍ التحقق من حالة الدعم'),('HELD','pay-self','failed',False,'تم تسجيل دعمك'),('CAPTURED','pay-self','paid',False,'تم تسجيل دعمك'),('PENDING_BNPL','pay-self','paid',False,'تم تسجيل دعمك'),('REFUNDED','pay-self','paid',False,'تم رد المساهمة أو فك الحجز'),('HELD','pay-other','paid',False,'جارٍ التحقق من حالة الدعم'),('HELD','pay-self','paid',True,'جارٍ التحقق من حالة الدعم')]
  for status,ref,query_status,fail,heading in cases:
   state['fail']=fail
   state['rows']=[{'id':'pledge-ui-test','projectId':'project-ui-test','backerId':'ui-test','amountHalalas':2000,'addOnsHalalas':0,'status':status,'createdAt':'2026-10-14T00:00:00.000Z','capturedAt':None,'refundedAt':None,'paymentRef':'pay-self','projectTitleAr':'حملة اختبار الواجهة'}]
   page.goto(f'http://127.0.0.1:3003/projects/project-ui-test/back/success?ref={ref}&status={query_status}',wait_until='domcontentloaded')
   page.wait_for_load_state('networkidle')
   expect(page.get_by_role('heading',level=1,name=heading,exact=True)).to_be_visible()
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
   if heading!='تم تسجيل دعمك':expect(page.get_by_text('شارك دعمك وضاعف أثره',exact=True)).to_have_count(0)
   out.append({'status':status,'requestedRef':ref,'urlStatus':query_status,'apiUnavailable':fail,'heading':heading,'pass':True})
   if status=='PENDING_AUTH':page.screenshot(path='.cache/audit/pending-return-mobile.png',full_page=False)
  state['fail']=False;state['rows'][0]['status']='PENDING_AUTH'
  page.goto('http://127.0.0.1:3003/projects/me/pledges');page.wait_for_load_state('networkidle')
  expect(page.get_by_text('جارٍ التحقق من الحجز — لم يُحتسب الدعم بعد',exact=True)).to_be_visible()
  out.append({'case':'pending pledge label','pass':True})
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/pending-return-ui.json').write_text(json.dumps({'scope':'Built web UI with isolated mock API; not real provider or backend integration','checks':out},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'passed':len(out)}))
