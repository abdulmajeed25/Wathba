import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
import json
state={'action':'AUTHORIZE','pending':True,'outcome':'pending','gone':False,'deadline':'2030-01-01T00:00:00Z','calls':[],'retry':'unknown'}
row={'id':'33333333-3333-4333-8333-333333333333','projectId':'22222222-2222-4222-8222-222222222222','backer':{'name':'داعم اختبار','email':'a***@e***.com'},'amountHalalas':'1200','addOnsHalalas':'600','status':'CAPTURE_GRACE','paymentMethod':'CARD','createdAt':'2026-10-14T00:00:00Z'}
errors=[];mock_errors=[];checks=[]
class Api(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send(self,data,code=200):
  self.send_response(code);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_GET(self):
  path=urlparse(self.path).path
  if path=='/v1/platform/status':self.send({'maintenance':False})
  elif path=='/v1/users/me':self.send({'id':'isolated-ops-ui','name':'حساب اختبار','roles':['ADMIN']})
  elif path=='/v1/pledges/me':self.send({'items':[dict(row,amountHalalas=1200,addOnsHalalas=600,projectTitleAr='مشروع اختبار البطاقة',backerId='isolated-ops-ui',capturedAt=None,refundedAt=None,paymentRef='local-only',paymentVerificationPending=state['pending'],graceExpiresAt=state['deadline'],projectStatus='SUCCESSFUL')]})
  elif path=='/v1/ops/auth/session':self.send({'roleKeys':['OWNER'],'permissions':['*'],'fourEyes':True,'moneyAdmins':2})
  elif path=='/v1/ops/dashboard':self.send({'workQueue':{},'vitals':{}})
  elif path=='/v1/ops/alerts':self.send({'items':[]})
  elif path=='/v1/ops/money/pledges':self.send({'items':[] if state['gone'] else [dict(row,authorizationIssue=f"payment:{state['action']}:11111111-1111-4111-8111-111111111111")],'nextCursor':None})
  else:self.send({},404)
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
  if self.path=='/v1/events':self.send({'ok':True});return
  state['calls'].append(self.path)
  if self.path==f"/v1/pledges/{row['id']}/retry":
   assert list(body)==['source'] and body['source'].startswith('tok_stub_'), 'Only local token may reach Wathba API'
   state['pending']=True;self.send({'message':'لم تتأكد نتيجة الدفع'},503);return
  if not any(k in self.path for k in ['/money.hold.reconcile/','/money.replacement.capture/']):mock_errors.append(self.path);self.send({},400);return
  assert body.get('input')=={'pledgeId':row['id']}
  if self.path.endswith('/dry-run'):
   self.send({'ok':True,'blockers':[],'preview':{'summaryAr':'قراءة الدفع ثم استكمال التحصيل وفق الدليل','before':None,'after':None}});return
  assert len(body['reason'])>=10 and self.headers.get('x-idempotency-key')
  if state['outcome']=='outage':
   state['action']='CAPTURE';self.send({'message':'لم يتأكد التحصيل؛ راجع النتيجة دون إعادة الدفع.'},503)
  elif state['outcome']=='queued':self.send({'queued':True,'result':None})
  elif '/money.replacement.capture/' in self.path:
   state['gone']=True;self.send({'result':{'ok':True}})
  else:self.send({'result':{'outcome':state['outcome'],'action':state['action']}})
server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':1440,'height':1000})
  context.add_cookies([{'name':n,'value':v,'url':'http://127.0.0.1:3003'} for n,v in [('wathba_session','isolated-admin-token'),('wathba_ops_session','isolated-ops-token')]])
  context.route('https://api.moyasar.com/**',lambda route:route.abort())
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:3003/ops/money?tab=refunds&status=CAPTURE_GRACE');page.wait_for_load_state('networkidle')
  verify=page.get_by_role('button',name='التحقق من العملية المالية',exact=True)
  resume=page.get_by_role('button',name='استكمال تحصيل البطاقة الجديدة',exact=True)
  expect(verify).to_be_visible();expect(resume).to_be_visible();expect(page.get_by_role('button',name='استرداد',exact=True)).to_have_count(0)
  checks.append('grace authorization exposes GET verification and separate governed continuation')
  def open_dialog(button):
   button.click();expect(page.get_by_role('dialog')).to_be_visible();expect(page.get_by_text('قراءة الدفع ثم استكمال التحصيل وفق الدليل',exact=True)).to_be_visible()
  def execute():
   page.get_by_label('السبب (10 أحرف على الأقل — يُسجَّل في التدقيق)',exact=True).fill('استكمال محلي لتفويض بطاقة محفوظ')
   page.get_by_label('عملية مالية — اكتب «نعم» للتأكيد',exact=True).fill('نعم')
   page.get_by_role('button',name='تنفيذ العملية المالية',exact=True).click()
  open_dialog(verify);execute();expect(page.get_by_role('status')).to_contain_text('لم تتأكد نتيجة العملية');page.get_by_role('button',name='تم',exact=True).click()
  assert not any('/money.replacement.capture/' in c for c in state['calls']);checks.append('verification never invokes continuation')
  state['outcome']='uncharged';open_dialog(verify);execute();expect(page.get_by_role('status')).to_contain_text('أكد المزود عدم التحصيل');page.get_by_role('button',name='تم',exact=True).click();checks.append('uncharged proof does not claim a capture or refund')
  open_dialog(resume);expect(page.get_by_role('button',name='تنفيذ العملية المالية',exact=True)).to_be_disabled();state['outcome']='queued';execute()
  expect(page.get_by_role('status')).to_contain_text('لم يُنفذ بعد');page.keyboard.press('Escape');checks.append('continuation needs reason and confirmation; queued is not success')
  state['outcome']='outage';open_dialog(resume);execute();expect(page.get_by_role('dialog').get_by_role('alert')).to_contain_text('لم يتأكد التحصيل');page.keyboard.press('Escape');expect(resume).to_have_count(0);expect(verify).to_be_visible();checks.append('unknown continuation refreshes to GET verification without another capture')
  state['action']='AUTHORIZE';page.reload()
  state['outcome']='confirmed';page.set_viewport_size({'width':390,'height':844});open_dialog(resume)
  for _ in range(8):page.keyboard.press('Tab');assert page.get_by_role('dialog').evaluate('(el)=>el.contains(document.activeElement)')
  execute();expect(page.get_by_role('status')).to_contain_text('تأكد تحصيل البطاقة الجديدة');page.screenshot(path='.cache/audit/grace-admin-mobile.png',full_page=True)
  page.get_by_role('button',name='تم',exact=True).click();expect(page.get_by_text('لا تعهدات مطابقة.',exact=True)).to_be_visible();checks.append('confirmed continuation refreshes pending list on close and mobile dialog retains focus')
  state['gone']=False;state['action']='CAPTURE';page.reload();expect(verify).to_be_visible();expect(resume).to_have_count(0);checks.append('pending capture offers verification without another capture')
  page.goto('http://127.0.0.1:3003/projects/me/pledges');page.wait_for_load_state('networkidle')
  expect(page.get_by_text('عملية مالية قيد التحقق',exact=True)).to_be_visible();expect(page.get_by_role('button',name='حدّث بطاقتك',exact=False)).to_have_count(0);checks.append('pending grace hides second payment for backer')
  state['pending']=False;state['deadline']='2020-01-01T00:00:00Z';page.reload()
  expect(page.get_by_text('انتهت مهلة الدفع؛ نراجع نتيجة التعهد قبل اعتماد فشله أو تحرير المكافأة.',exact=True)).to_be_visible();expect(page.get_by_role('button',name='حدّث بطاقتك',exact=False)).to_have_count(0);checks.append('expired grace offers no payment and explains review')
  state['deadline']='2030-01-01T00:00:00Z';page.reload();page.get_by_role('button',name='حدّث بطاقتك',exact=False).click()
  page.get_by_label('رقم البطاقة',exact=True).fill('4111111111111111');page.get_by_label('تاريخ الانتهاء',exact=True).fill('12/30');page.get_by_label('CVC',exact=True).fill('123');page.get_by_label('الاسم على البطاقة',exact=True).fill('LOCAL TEST')
  expect(page.get_by_label('CVC',exact=True)).to_have_attribute('type','password')
  for width in [320,768,1440]:
   page.set_viewport_size({'width':width,'height':1000})
   for locator in [page.get_by_label('رقم البطاقة',exact=True),page.get_by_label('CVC',exact=True),page.get_by_role('button',name='سحب الآن',exact=True)]:
    box=locator.bounding_box();assert box and box['x']>=0 and box['x']+box['width']<=width+1, (width,box)
   checks.append(f'card fields and payment button fit inside {width}px viewport')
  page.set_viewport_size({'width':390,'height':844})
  page.screenshot(path='.cache/audit/grace-card-mobile.png',full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth<=390'), 'card form overflows mobile'
  page.get_by_role('button',name='سحب الآن',exact=True).click()
  expect(page.get_by_text('لم تتأكد نتيجة الدفع. نحدّث حالة تعهدك؛ لا تدفع مجددًا قبل التحقق.',exact=True)).to_be_visible()
  expect(page.get_by_text('عملية مالية قيد التحقق',exact=True)).to_be_visible();expect(page.get_by_label('رقم البطاقة',exact=True)).to_have_count(0)
  assert sum(c.endswith('/retry') for c in state['calls'])==1
  checks.append('unknown card request uses token only, clears card form, refreshes pending status and discourages repayment')
  page.screenshot(path='.cache/audit/grace-backer-mobile.png',full_page=True)
  assert not errors,errors
  assert not mock_errors,mock_errors
  browser.close()
finally:server.shutdown();server.server_close()
Path('.cache/audit/grace-ui.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'pageErrors':errors,'mockErrors':mock_errors},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False))
