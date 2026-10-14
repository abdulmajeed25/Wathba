import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
import json

state={'outcome':'pending','writes':[],'confirmed':False,'issue':None}
row={'id':'33333333-3333-4333-8333-333333333333','projectId':'22222222-2222-4222-8222-222222222222',
 'backer':{'name':'داعم محلي','email':'a***@e***.com'},'amountHalalas':'1200','addOnsHalalas':'600','status':'CAPTURED',
 'paymentMethod':'CARD','createdAt':'2026-10-14T00:00:00Z','refundRequestedAt':'2026-10-14T01:00:00Z','refundReservedHalalas':'1800','refundIssue':'refund-outcome-unknown'}
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
  elif path=='/v1/ops/money/pledges':
   assert self.headers.get('x-ops-token')=='isolated-ops-token'
   self.send({'items':[] if state['confirmed'] else [dict(row,refundIssue=state['issue'] or row['refundIssue'])],'nextCursor':None})
  else:self.send({},404)
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
  state['writes'].append({'path':self.path,'body':body,'key':self.headers.get('x-idempotency-key')})
  assert '/money.refund.reconcile/' in self.path,self.path
  assert body['input']=={'pledgeId':row['id']},body
  if self.path.endswith('/dry-run'):
   self.send({'ok':True,'blockers':[],'preview':{'summaryAr':'قراءة نتيجة الاسترداد دون إرسال طلب استرداد جديد','before':{'reservedHalalas':'1800'},'after':{'status':'حسب الدليل'}}});return
  assert len(body['reason'])>=10 and self.headers.get('x-idempotency-key')
  outcome=state['outcome']
  if outcome=='forbidden':self.send({'message':'يلزم إعادة توثيق الجلسة'},403)
  elif outcome=='outage':self.send({'message':'تعذر قراءة نتيجة الاسترداد لدى المزود؛ بقي الحجز محفوظًا.'},503)
  elif outcome=='queued':self.send({'result':None,'queued':True,'proposalId':'proposal-local'})
  else:
   state['confirmed']=outcome=='confirmed'
   state['issue']='refund-partial-needs-review' if outcome=='partial' else 'refund-not-confirmed'
   self.send({'result':{'outcome':outcome,'refundedHalalas':'1800' if outcome=='confirmed' else '500' if outcome=='partial' else '0'}})

server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start()
checks=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':1440,'height':1000})
  context.add_cookies([{'name':n,'value':v,'url':'http://127.0.0.1:3003'} for n,v in [('wathba_session','isolated-admin-token'),('wathba_ops_session','isolated-ops-token')]])
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  browser_keys=[]
  page.on('request',lambda r: browser_keys.append(r.headers.get('x-idempotency-key')) if '/money.refund.reconcile/execute' in r.url else None)
  url='http://127.0.0.1:3003/ops/money?tab=refunds&status=REFUND_PENDING'
  def open_preview():
   page.get_by_role('button',name='التحقق من الاسترداد',exact=True).click()
   expect(page.get_by_role('dialog')).to_be_visible()
   expect(page.get_by_text('قراءة نتيجة الاسترداد دون إرسال طلب استرداد جديد',exact=True)).to_be_visible()
  def execute():
   page.get_by_label('السبب (10 أحرف على الأقل — يُسجَّل في التدقيق)',exact=True).fill('مطابقة محلية لمحاولة استرداد محفوظة')
   page.get_by_label('عملية مالية — اكتب «نعم» للتأكيد',exact=True).fill('نعم')
   page.get_by_role('button',name='تنفيذ العملية المالية',exact=True).click()
  page.goto(url);page.wait_for_load_state('networkidle')
  expect(page.get_by_role('button',name='استرداد',exact=True)).to_have_count(0)
  open_preview();assert len(state['writes'])==1 and state['writes'][0]['path'].endswith('/dry-run')
  expect(page.get_by_role('button',name='تنفيذ العملية المالية',exact=True)).to_be_disabled()
  checks.append('preview only, saved pledge identifier, resubmission absent and confirmation required')
  execute()
  expect(page.get_by_role('status')).to_contain_text('لم يؤكد المزود الاسترداد بعد')
  page.get_by_role('button',name='تم',exact=True).click()
  expect(page.get_by_text('آخر تحقق لم يؤكد الاسترداد؛ الحجز قائم.',exact=True)).to_be_visible()
  checks.append('pending response is a warning, keeps reservation and refreshes after acknowledgement')
  state['outcome']='partial';open_preview();execute()
  expect(page.get_by_role('status')).to_contain_text('أفاد المزود برد جزء فقط')
  page.screenshot(path='.cache/audit/refund-verification-desktop.png',full_page=True)
  page.get_by_role('button',name='تم',exact=True).click()
  expect(page.get_by_text('أفاد المزود برد جزء من المبلغ؛ لم يُعتمد الرد الكامل، ويلزم مراجعة الفرق.',exact=True)).to_be_visible()
  checks.append('partial response never says refunded in full and remains visible after refresh')
  state['outcome']='queued';open_preview();execute()
  expect(page.get_by_role('status')).to_contain_text('أُرسل طلب التحقق للمراجعة؛ لم يُنفذ بعد.')
  page.keyboard.press('Escape');expect(page.get_by_role('button',name='التحقق من الاسترداد',exact=True)).to_be_visible()
  checks.append('second-approval queue is not presented as completed verification')
  for outcome in ['forbidden','outage']:
   state['outcome']=outcome;open_preview();execute()
   expect(page.get_by_role('dialog').get_by_role('alert')).to_contain_text('توثيق' if outcome=='forbidden' else 'تعذر قراءة')
   if outcome=='forbidden':expect(page.get_by_role('link',name='إعادة التوثيق →',exact=True)).to_be_visible()
   page.keyboard.press('Escape');expect(page.get_by_role('button',name='التحقق من الاسترداد',exact=True)).to_be_visible()
   checks.append(outcome+': explicit failure without hiding pending pledge or showing success')
  page.set_viewport_size({'width':390,'height':844})
  trigger=page.get_by_role('button',name='التحقق من الاسترداد',exact=True);trigger.focus();expect(trigger).to_be_focused()
  page.keyboard.press('Enter');expect(page.get_by_role('dialog')).to_be_visible()
  for _ in range(8):
   page.keyboard.press('Tab');assert page.get_by_role('dialog').evaluate('(el)=>el.contains(document.activeElement)')
  state['outcome']='partial';execute();expect(page.get_by_role('status')).to_contain_text('أفاد المزود برد جزء فقط')
  assert page.evaluate('document.documentElement.scrollWidth<=390')
  page.screenshot(path='.cache/audit/refund-verification-mobile.png',full_page=True)
  page.keyboard.press('Escape');expect(trigger).to_be_focused()
  checks.append('390px dialog fits, keyboard activation and focus cycle work, Escape restores focus')
  state['outcome']='confirmed';open_preview();execute()
  expect(page.get_by_role('status')).to_contain_text('أكد المزود رد المبلغ كاملًا، وحُفظت النتيجة المالية.')
  expect(page.get_by_role('dialog')).to_be_visible()
  page.get_by_role('button',name='تم',exact=True).click()
  expect(page.get_by_text('لا تعهدات مطابقة.',exact=True)).to_be_visible()
  expect(page.get_by_role('button',name='التحقق من الاسترداد',exact=True)).to_have_count(0)
  checks.append('confirmed result remains readable until close then exits pending filter')
  forwarded=[w['key'] for w in state['writes'] if w['path'].endswith('/execute')]
  assert forwarded==browser_keys and all(forwarded) and len(set(forwarded))==len(forwarded)
  checks.append('each browser idempotency key reaches the API unchanged; separate attempts have distinct keys')
  before=len(state['writes']);anonymous=browser.new_context()
  response=anonymous.request.post('http://127.0.0.1:3003/api/ops/operations/money.refund.reconcile/execute',data={'input':{'pledgeId':row['id']}})
  assert response.status==401 and len(state['writes'])==before
  anonymous.close();checks.append('unauthenticated request is rejected by proxy before contacting API')
  assert not errors,errors
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/refund-verification-ui.json').write_text(json.dumps({'scope':'Built web with isolated mock API; real PostgreSQL service verified separately; no real provider','checks':checks},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'passed':len(checks)}))
