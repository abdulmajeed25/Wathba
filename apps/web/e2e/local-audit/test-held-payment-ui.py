import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
import json
mock_errors=[]
state={'outcome':'pending','issue':'payment:CAPTURE:11111111-1111-4111-8111-111111111111','confirmed':False,'calls':[],'backer_state':'HELD','method':'CARD','captured':False}
row={'id':'33333333-3333-4333-8333-333333333333','projectId':'22222222-2222-4222-8222-222222222222',
 'backer':{'name':'داعم اختبار','email':'a***@e***.com'},'amountHalalas':'1200','addOnsHalalas':'600',
 'status':'HELD','paymentMethod':'CARD','createdAt':'2026-10-14T00:00:00Z'}
class Api(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send(self,data,code=200):
  self.send_response(code);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_GET(self):
  path=urlparse(self.path).path
  if path=='/v1/platform/status':self.send({'maintenance':False})
  elif path=='/v1/users/me':self.send({'id':'isolated-ops-ui','name':'إدارة اختبار','roles':['ADMIN']})
  elif path=='/v1/pledges/me':self.send({'items':[dict(row,amountHalalas=1200,addOnsHalalas=600,projectTitleAr='مشروع اختبار التحقق',backerId='isolated-ops-ui',status=state['backer_state'],paymentMethod=state['method'],capturedAt='2026-10-13T00:00:00Z' if state['captured'] else None,refundedAt=None,paymentRef='local-only',paymentVerificationPending=state['backer_state']=='HELD',cancellableUntil='2030-01-01T00:00:00Z',projectStatus='LIVE')]})
  elif path=='/v1/ops/auth/session':self.send({'roleKeys':['OWNER'],'permissions':['*'],'fourEyes':True,'moneyAdmins':2})
  elif path=='/v1/ops/dashboard':self.send({'workQueue':{},'vitals':{}})
  elif path=='/v1/ops/alerts':self.send({'items':[]})
  elif path=='/v1/ops/money/pledges':self.send({'items':[] if state['confirmed'] else [dict(row,authorizationIssue=state['issue'])],'nextCursor':None})
  else:self.send({},404)
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
  if self.path=='/v1/events':self.send({'ok':True});return
  state['calls'].append(self.path)
  if '/money.hold.reconcile/' not in self.path or body.get('input')!={'pledgeId':row['id']}:
   mock_errors.append(self.path);self.send({'message':'unexpected mock request'},400);return
  if self.path.endswith('/dry-run'):
   self.send({'ok':True,'blockers':[],'preview':{'summaryAr':'قراءة المحاولة دون إعادة طلب مالي','before':{'status':'HELD'},'after':{'status':'حسب الدليل'}}});return
  assert len(body['reason'])>=10 and self.headers.get('x-idempotency-key')
  if state['outcome']=='queued':self.send({'queued':True,'result':None})
  elif state['outcome']=='outage':self.send({'message':'تعذرت قراءة نتيجة المحاولة؛ بقي التعهد قيد المراجعة.'},503)
  else:
   state['confirmed']=state['outcome']=='confirmed';state['issue']=state['issue']
   self.send({'result':{'outcome':state['outcome'],'action':state['issue'].split(':')[1]}})
server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start();checks=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':1440,'height':1000})
  context.add_cookies([{'name':n,'value':v,'url':'http://127.0.0.1:3003'} for n,v in [('wathba_session','isolated-admin-token'),('wathba_ops_session','isolated-ops-token')]])
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:3003/ops/money?tab=refunds&status=HELD');page.wait_for_load_state('networkidle')
  trigger=page.get_by_role('button',name='التحقق من العملية المالية',exact=True)
  expect(trigger).to_be_visible();expect(page.get_by_role('button',name='استرداد',exact=True)).to_have_count(0)
  expect(page.get_by_text('توجد محاولة تحصيل لم تُحسم. تحقّق من نتيجتها قبل أي طلب مالي آخر.',exact=True)).to_be_visible()
  checks.append('pending hold shows verification only and no refund or resubmit')
  def open_preview():
   trigger.click();expect(page.get_by_role('dialog')).to_be_visible()
   expect(page.get_by_text('قراءة المحاولة دون إعادة طلب مالي',exact=True)).to_be_visible()
  def execute():
   page.get_by_label('السبب (10 أحرف على الأقل — يُسجَّل في التدقيق)',exact=True).fill('مطابقة محلية لمحاولة فك محفوظة')
   page.get_by_label('عملية مالية — اكتب «نعم» للتأكيد',exact=True).fill('نعم')
   page.get_by_role('button',name='تنفيذ العملية المالية',exact=True).click()
  open_preview();expect(page.get_by_role('button',name='تنفيذ العملية المالية',exact=True)).to_be_disabled()
  assert len(state['calls'])==1 and state['calls'][0].endswith('/dry-run');checks.append('preview does not execute and needs reason plus confirmation')
  execute();expect(page.get_by_role('status')).to_contain_text('لم تتأكد نتيجة العملية')
  page.screenshot(path='.cache/audit/held-payment-desktop.png',full_page=True)
  page.get_by_role('button',name='تم',exact=True).click()
  expect(page.get_by_text('توجد محاولة تحصيل لم تُحسم. تحقّق من نتيجتها قبل أي طلب مالي آخر.',exact=True)).to_be_visible()
  checks.append('pending response preserves held state and explains that no request was resent')
  state['outcome']='queued';open_preview();execute()
  expect(page.get_by_role('status')).to_contain_text('لم يُنفذ بعد');page.keyboard.press('Escape')
  checks.append('second approval queue does not claim funds released')
  state['outcome']='outage';open_preview();execute()
  expect(page.get_by_role('dialog').get_by_role('alert')).to_contain_text('تعذرت قراءة نتيجة المحاولة')
  page.keyboard.press('Escape');expect(trigger).to_be_visible();checks.append('provider outage leaves pending action visible without success')
  page.set_viewport_size({'width':390,'height':844});trigger.focus();page.keyboard.press('Enter')
  expect(page.get_by_role('dialog')).to_be_visible()
  for _ in range(8):
   page.keyboard.press('Tab');assert page.get_by_role('dialog').evaluate('(el)=>el.contains(document.activeElement)')
  state['outcome']='confirmed';execute();expect(page.get_by_role('status')).to_contain_text('أكد المزود تحصيل المبلغ كاملًا')
  assert page.evaluate('document.documentElement.scrollWidth<=390')
  page.screenshot(path='.cache/audit/held-payment-mobile.png',full_page=True)
  page.get_by_role('button',name='تم',exact=True).click();expect(page.get_by_text('لا تعهدات مطابقة.',exact=True)).to_be_visible()
  checks.append('confirmed result readable on 390px, keyboard stays in dialog, row leaves pending filter only after close')
  state['confirmed']=False;state['outcome']='pending';state['issue']='payment:REAUTHORIZE:11111111-1111-4111-8111-111111111111';page.reload()
  open_preview();execute();expect(page.get_by_role('status')).to_contain_text('لا يثبت تجديد مدته');page.keyboard.press('Escape')
  checks.append('authorized snapshot is not described as successful renewal')
  state['issue']='payment:VOID:11111111-1111-4111-8111-111111111111';state['outcome']='confirmed';page.reload()
  open_preview();execute();expect(page.get_by_role('status')).to_contain_text('حُدّث تمويل الحملة والمخزون');page.get_by_role('button',name='تم',exact=True).click()
  checks.append('held void explains counted funding and inventory compensation')
  state['confirmed']=False;state['issue']=None;page.reload()
  expect(trigger).to_have_count(0);expect(page.get_by_role('button',name='استرداد',exact=True)).to_be_visible()
  checks.append('ordinary hold still permits the normal refund action')
  page.goto('http://127.0.0.1:3003/projects/me/pledges');page.wait_for_load_state('networkidle')
  expect(page.get_by_text('عملية مالية قيد التحقق',exact=True)).to_be_visible()
  expect(page.get_by_text('نراجع نتيجة العملية مع مزود الدفع. لا يلزمك دفع جديد الآن؛ ستظهر النتيجة هنا بعد التحقق.',exact=True)).to_be_visible()
  expect(page.get_by_role('button',name='إلغاء التعهد',exact=True)).to_have_count(0)
  page.screenshot(path='.cache/audit/held-payment-backer-mobile.png',full_page=True)
  checks.append('backer sees verification pending without cancel or second payment action')
  expect(page.get_by_role('link',name='عرض المشروع',exact=True)).to_be_visible()
  expect(page.get_by_text('يُسترد كامل المبلغ تلقائياً',exact=False)).to_have_count(0)
  for method,captured,label,explanation in [
   ('CARD',False,'فُكّ الحجز','سُجّل فك حجز المبلغ لدى مزود الدفع'),
   ('CARD',True,'مسترَد','سُجّل استرداد المبلغ إلى وسيلة الدفع'),
   ('BNPL',False,'أُلغي طلب التقسيط','أُلغي طلب الدعم بالتقسيط دون تحصيل المبلغ')]:
   state['backer_state']='REFUNDED';state['method']=method;state['captured']=captured;page.reload()
   expect(page.get_by_text(label,exact=True)).to_be_visible();expect(page.get_by_text(explanation,exact=False)).to_be_visible()
   expect(page.get_by_text('3–14',exact=False)).to_have_count(0)
   checks.append(f'backer {method} captured={captured} distinguishes release, refund and uncharged intent without invented deadline')
  assert not errors,errors
  assert not mock_errors,mock_errors
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/held-payment-ui.json').write_text(json.dumps({'scope':'Built web and mock API, PostgreSQL tested separately','checks':checks},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'passed':len(checks)}))
