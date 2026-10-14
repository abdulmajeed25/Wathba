import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
pid='33333333-3333-4333-8333-333333333333'
state={'issue':'authorization-terms-changed','outcome':'queued','gone':False,'calls':[]}
checks=[];errors=[]
class Api(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send(self,data,code=200):
  self.send_response(code);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_GET(self):
  path=self.path.split('?')[0]
  if path=='/v1/platform/status':self.send({'maintenance':False})
  elif path=='/v1/users/me':self.send({'id':'isolated','name':'اختبار','roles':['ADMIN']})
  elif path=='/v1/ops/auth/session':self.send({'roleKeys':['OWNER'],'permissions':['*'],'fourEyes':True,'moneyAdmins':2})
  elif path=='/v1/ops/dashboard':self.send({'workQueue':{},'vitals':{}})
  elif path=='/v1/ops/alerts':self.send({'items':[]})
  elif path=='/v1/ops/money/pledges':self.send({'items':[] if state['gone'] else [{'id':pid,'projectId':'22222222-2222-4222-8222-222222222222','backer':{'name':'داعم اختبار','email':'a***@e***.com'},'amountHalalas':'2000','addOnsHalalas':'0','status':'PENDING_AUTH','paymentMethod':'CARD','authorizationRecoverable':not state['issue'].startswith('void-'),'authorizationIssue':state['issue'],'createdAt':'2026-10-14T00:00:00Z'}],'nextCursor':None})
  else:self.send({},404)
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
  if self.path=='/v1/events':self.send({'ok':True});return
  state['calls'].append(self.path)
  assert '/money.authorization.release/' in self.path or '/money.void.reconcile/' in self.path
  assert body['input']=={'pledgeId':pid}
  if self.path.endswith('/dry-run'):
   self.send({'ok':True,'blockers':[],'preview':{'summaryAr':'فك حجز غير محتسب دون إنقاص تمويل الحملة أو المخزون','before':None,'after':None}});return
  assert len(body['reason'])>=10 and self.headers.get('x-idempotency-key')
  if '/money.void.reconcile/' in self.path:self.send({'result':{'outcome':'pending'}});return
  if state['outcome']=='queued':self.send({'queued':True,'result':None})
  elif state['outcome']=='unknown':state['issue']='void-outcome-unknown';self.send({'message':'لم يتأكد فك الحجز؛ تحقق من المحاولة المحفوظة.'},503)
  else:state['gone']=True;self.send({'result':{'ok':True}})
server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':1440,'height':1000})
  context.add_cookies([{'name':n,'value':'isolated-local-token','url':'http://127.0.0.1:3003'} for n in ['wathba_session','wathba_ops_session']])
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:3003/ops/money?tab=refunds&status=PENDING_AUTH');page.wait_for_load_state('networkidle')
  release=page.get_by_role('button',name='فك الحجز غير المحتسب',exact=True)
  verify=page.get_by_role('button',name='التحقق من فك الحجز',exact=True)
  expect(release).to_be_visible();expect(page.get_by_role('button',name='التحقق من الحجز الأول',exact=True)).to_be_visible();expect(page.get_by_role('button',name='استرداد',exact=True)).to_have_count(0)
  checks.append('rejected initial authorization exposes separate read and release, not captured refund')
  def open_release():
   release.click();expect(page.get_by_text('فك حجز غير محتسب دون إنقاص تمويل الحملة أو المخزون',exact=True)).to_be_visible()
   expect(page.get_by_role('button',name='تنفيذ العملية المالية',exact=True)).to_be_disabled()
  def execute():
   page.get_by_label('السبب (10 أحرف على الأقل — يُسجَّل في التدقيق)',exact=True).fill('فك حجز اختبار رفض بسبب تغير الشروط')
   page.get_by_label('عملية مالية — اكتب «نعم» للتأكيد',exact=True).fill('نعم')
   page.get_by_role('button',name='تنفيذ العملية المالية',exact=True).click()
  open_release();assert all(c.endswith('/dry-run') for c in state['calls']);checks.append('preview sends no execution and requires reason plus financial confirmation')
  execute();expect(page.get_by_role('dialog')).to_contain_text('لم يُنفذ بعد');page.keyboard.press('Escape');expect(release).to_be_visible();checks.append('second approval does not imply release or remove the pledge')
  state['outcome']='unknown';open_release();execute();expect(page.get_by_role('dialog').get_by_role('alert')).to_contain_text('لم يتأكد فك الحجز');page.keyboard.press('Escape')
  expect(release).to_have_count(0);expect(verify).to_be_visible();checks.append('lost release response refreshes to read-only verification, hiding another release')
  count=sum(c.endswith('/execute') for c in state['calls']);verify.click();execute();expect(page.get_by_role('dialog')).to_contain_text('لم يتأكد فك الحجز');page.keyboard.press('Escape')
  assert sum('/money.authorization.release/execute' in c for c in state['calls'])==2;checks.append('verification after unknown release never submits another release')
  state['issue']='authorization-challenge';page.reload();expect(release).to_have_count(0);checks.append('bank challenge cannot be released as rejected terms')
  state['issue']='authorization-terms-changed';state['outcome']='confirmed';page.reload();page.set_viewport_size({'width':390,'height':844});open_release()
  for _ in range(7):page.keyboard.press('Tab');assert page.get_by_role('dialog').evaluate('(el)=>el.contains(document.activeElement)')
  execute();expect(page.get_by_role('dialog')).to_contain_text('تأكد فك الحجز غير المحتسب');page.screenshot(path='.cache/audit/authorization-release-mobile.png',full_page=True)
  page.get_by_role('button',name='تم',exact=True).click();expect(page.get_by_text('لا تعهدات مطابقة.',exact=True)).to_be_visible();checks.append('confirmed result explains no counter decrement and refreshes list; mobile dialog traps focus')
  assert not errors,errors
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/authorization-release-ui.json').write_text(json.dumps({'scope':'Built Next UI with isolated mock API','passed':len(checks),'checks':checks,'pageErrors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False))
