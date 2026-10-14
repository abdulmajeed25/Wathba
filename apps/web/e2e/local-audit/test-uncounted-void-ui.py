import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
import json
state={'outcome':'pending','issue':'void-outcome-unknown','confirmed':False,'calls':[]}
row={'id':'33333333-3333-4333-8333-333333333333','projectId':'22222222-2222-4222-8222-222222222222',
 'backer':{'name':'داعم اختبار','email':'a***@e***.com'},'amountHalalas':'1200','addOnsHalalas':'600',
 'status':'PENDING_AUTH','paymentMethod':'CARD','createdAt':'2026-10-14T00:00:00Z'}
class Api(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send(self,data,code=200):
  self.send_response(code);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_GET(self):
  path=urlparse(self.path).path
  if path=='/v1/platform/status':self.send({'maintenance':False})
  elif path=='/v1/users/me':self.send({'id':'isolated-ops-ui','name':'إدارة اختبار','roles':['ADMIN']})
  elif path=='/v1/ops/auth/session':self.send({'roleKeys':['OWNER'],'permissions':['*'],'fourEyes':True,'moneyAdmins':2})
  elif path=='/v1/ops/dashboard':self.send({'workQueue':{},'vitals':{}})
  elif path=='/v1/ops/alerts':self.send({'items':[]})
  elif path=='/v1/ops/money/pledges':self.send({'items':[] if state['confirmed'] else [dict(row,authorizationIssue=state['issue'])],'nextCursor':None})
  else:self.send({},404)
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
  state['calls'].append(self.path)
  assert '/money.void.reconcile/' in self.path and body['input']=={'pledgeId':row['id']}
  if self.path.endswith('/dry-run'):
   self.send({'ok':True,'blockers':[],'preview':{'summaryAr':'قراءة فك الحجز دون تغيير رصيد الحملة أو المخزون','before':{'status':'PENDING_AUTH'},'after':{'status':'حسب الدليل'}}});return
  assert len(body['reason'])>=10 and self.headers.get('x-idempotency-key')
  if state['outcome']=='queued':self.send({'queued':True,'result':None})
  elif state['outcome']=='outage':self.send({'message':'تعذر قراءة نتيجة فك الحجز؛ بقي التعهد قيد المراجعة.'},503)
  else:
   state['confirmed']=state['outcome']=='confirmed';state['issue']='void-not-confirmed'
   self.send({'result':{'outcome':state['outcome']}})
server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start();checks=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':1440,'height':1000})
  context.add_cookies([{'name':n,'value':v,'url':'http://127.0.0.1:3003'} for n,v in [('wathba_session','isolated-admin-token'),('wathba_ops_session','isolated-ops-token')]])
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:3003/ops/money?tab=refunds&status=PENDING_AUTH');page.wait_for_load_state('networkidle')
  trigger=page.get_by_role('button',name='التحقق من فك الحجز',exact=True)
  expect(trigger).to_be_visible();expect(page.get_by_role('button',name='استرداد',exact=True)).to_have_count(0)
  expect(page.get_by_text('لم يتأكد فك الحجز؛ لا يُعد المبلغ مستردًا حتى التحقق.',exact=True)).to_be_visible()
  checks.append('unknown uncounted void shows verification only and no refund or resubmit')
  def open_preview():
   trigger.click();expect(page.get_by_role('dialog')).to_be_visible()
   expect(page.get_by_text('قراءة فك الحجز دون تغيير رصيد الحملة أو المخزون',exact=True)).to_be_visible()
  def execute():
   page.get_by_label('السبب (10 أحرف على الأقل — يُسجَّل في التدقيق)',exact=True).fill('مطابقة محلية لمحاولة فك محفوظة')
   page.get_by_label('عملية مالية — اكتب «نعم» للتأكيد',exact=True).fill('نعم')
   page.get_by_role('button',name='تنفيذ العملية المالية',exact=True).click()
  open_preview();expect(page.get_by_role('button',name='تنفيذ العملية المالية',exact=True)).to_be_disabled()
  assert len(state['calls'])==1 and state['calls'][0].endswith('/dry-run');checks.append('preview does not execute and needs reason plus confirmation')
  execute();expect(page.get_by_role('status')).to_contain_text('لم يتأكد فك الحجز')
  page.screenshot(path='.cache/audit/uncounted-void-desktop.png',full_page=True)
  page.get_by_role('button',name='تم',exact=True).click()
  expect(page.get_by_text('آخر قراءة لم تثبت فك الحجز؛ التعهد غير محتسب ولا يُعاد الطلب تلقائيًا.',exact=True)).to_be_visible()
  checks.append('pending response preserves uncounted state and explains that no request was resent')
  state['outcome']='queued';open_preview();execute()
  expect(page.get_by_role('status')).to_contain_text('لم يُنفذ بعد');page.keyboard.press('Escape')
  checks.append('second approval queue does not claim funds released')
  state['outcome']='outage';open_preview();execute()
  expect(page.get_by_role('dialog').get_by_role('alert')).to_contain_text('تعذر قراءة نتيجة فك الحجز')
  page.keyboard.press('Escape');expect(trigger).to_be_visible();checks.append('provider outage leaves pending action visible without success')
  page.set_viewport_size({'width':390,'height':844});trigger.focus();page.keyboard.press('Enter')
  expect(page.get_by_role('dialog')).to_be_visible()
  for _ in range(8):
   page.keyboard.press('Tab');assert page.get_by_role('dialog').evaluate('(el)=>el.contains(document.activeElement)')
  state['outcome']='confirmed';execute();expect(page.get_by_role('status')).to_contain_text('أكد المزود فك الحجز')
  assert page.evaluate('document.documentElement.scrollWidth<=390')
  page.screenshot(path='.cache/audit/uncounted-void-mobile.png',full_page=True)
  page.get_by_role('button',name='تم',exact=True).click();expect(page.get_by_text('لا تعهدات مطابقة.',exact=True)).to_be_visible()
  checks.append('confirmed result readable on 390px, keyboard stays in dialog, row leaves pending filter only after close')
  state['confirmed']=False;state['issue']='finalization-outcome-unknown';page.reload()
  expect(trigger).to_have_count(0);expect(page.get_by_text('نتيجة حفظ التعهد غير مؤكدة؛ يلزم مطابقة الحالة والسجل المالي.',exact=True)).to_be_visible()
  assert not errors,errors;checks.append('unknown finalization is not offered uncounted-void reconciliation')
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/uncounted-void-ui.json').write_text(json.dumps({'scope':'Built web and mock API, PostgreSQL tested separately','checks':checks},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'passed':len(checks)}))
