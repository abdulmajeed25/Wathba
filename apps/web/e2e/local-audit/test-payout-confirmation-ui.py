import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
import json

state={'status':200,'filters':[],'writes':[]}
base={'projectId':'22222222-2222-4222-8222-222222222222','creator':{'name':'حملة محلية'},'grossHalalas':'100000','netHalalas':'94250','feeWithheldHalalas':'5750'}
rows=[dict(base,id='33333333-3333-4333-8333-333333333333',status='SENDING',providerRef='local-saved-transfer',providerStatus='queued',failureReason='awaiting-provider-confirmation'),
 dict(base,id='44444444-4444-4444-8444-444444444444',status='SENDING',providerRef=None,failureReason='provider-outcome-needs-reconciliation'),
 dict(base,id='55555555-5555-4555-8555-555555555555',status='FAILED',providerRef='local-rejected-transfer',providerStatus='failed',failureReason='provider-rejected')]
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
  elif path=='/v1/ops/money/payouts':
   assert self.headers.get('x-ops-token')=='isolated-ops-token'
   status=parse_qs(urlparse(self.path).query).get('status',[''])[0];state['filters'].append(status)
   self.send({'items':[r for r in rows if not status or r['status']==status],'nextCursor':None},state['status'])
  elif path=='/v1/ops/money/pledges':self.send({'items':[{'id':'pledge-local','projectId':base['projectId'],'backer':{'name':'داعم'},'amountHalalas':'10000','addOnsHalalas':'1500','status':'HELD','paymentMethod':'CARD','createdAt':'2026-10-14T00:00:00Z'}],'nextCursor':None},state['status'])
  else:self.send({},404)
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}');state['writes'].append({'path':self.path,'body':body})
  if self.path.endswith('/dry-run'):self.send({'ok':True,'blockers':[],'preview':{'summaryAr':'قراءة التحويل المحفوظ دون إرسال مبلغ جديد','before':{'status':'SENDING'},'after':{'status':'حسب المزود'}}})
  else:self.send({'message':'رفض محاكى للتنفيذ'},403)
server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start()
checks=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':1440,'height':1000})
  context.add_cookies([{'name':n,'value':v,'url':'http://127.0.0.1:3003'} for n,v in [('wathba_session','isolated-admin-token'),('wathba_ops_session','isolated-ops-token')]])
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:3003/ops/money?tab=payouts');page.wait_for_load_state('networkidle')
  expect(page.locator('tbody tr')).to_have_count(3)
  first=page.locator('tbody tr').first
  expect(first.get_by_text('بانتظار التأكيد',exact=True)).to_be_visible()
  expect(first.get_by_text('في طابور المزود',exact=True)).to_be_visible()
  cells=first.locator('td').all_text_contents();assert '1,000' in cells[1] or '١٬٠٠٠' in cells[1],cells
  checks.append('gross uses the API gross field and queued transfer is visibly unconfirmed')
  expect(page.get_by_role('button',name='التحقق من التحويل',exact=True)).to_have_count(1)
  expect(page.get_by_role('button',name='إعادة المحاولة',exact=True)).to_have_count(0)
  expect(page.get_by_text('يلزم العثور على مرجع التحويل ومطابقته قبل المتابعة.',exact=True)).to_be_visible()
  checks.append('only saved pending transfer exposes verification; unknown or provider-rejected transfer has no resend action')
  page.get_by_role('button',name='التحقق من التحويل',exact=True).click()
  expect(page.get_by_role('dialog')).to_be_visible()
  expect(page.get_by_text('قراءة التحويل المحفوظ دون إرسال مبلغ جديد',exact=True)).to_be_visible()
  assert state['writes'][-1]['path'].endswith('/money.payout.reconcile/dry-run'),state['writes']
  assert all(w['path'].endswith('/dry-run') for w in state['writes'])
  checks.append('verification opens governed preview without executing a transfer')
  execute=page.get_by_role('button',name='تنفيذ العملية المالية',exact=True)
  expect(execute).to_be_disabled()
  page.get_by_label('السبب (10 أحرف على الأقل — يُسجَّل في التدقيق)',exact=True).fill('تحقق محلي من نتيجة التحويل المحفوظ')
  expect(execute).to_be_disabled()
  page.get_by_label('عملية مالية — اكتب «نعم» للتأكيد',exact=True).fill('نعم')
  expect(execute).to_be_enabled();execute.click()
  expect(page.get_by_text('خطأ: رفض محاكى للتنفيذ',exact=True)).to_be_visible()
  assert state['writes'][-1]['path'].endswith('/money.payout.reconcile/execute')
  checks.append('reason and typed confirmation are required; backend execution refusal is shown without success')
  page.keyboard.press('Escape')
  page.get_by_label('حالة الدفعات',exact=True).select_option('SENDING');page.get_by_role('button',name='تصفية',exact=True).click()
  page.wait_for_url('**status=SENDING**');expect(page.locator('tbody tr')).to_have_count(2)
  assert state['filters'][-1]=='SENDING';checks.append('status filter reaches the authenticated backend')
  page.screenshot(path='.cache/audit/payout-confirmation-desktop.png',full_page=True)
  for tab,noun in [('payouts','الدفعات'),('refunds','التعهدات')]:
   state['status']=503;page.goto(f'http://127.0.0.1:3003/ops/money?tab={tab}&status=HELD' if tab=='refunds' else 'http://127.0.0.1:3003/ops/money?tab=payouts&status=SENDING')
   expect(page.get_by_role('alert').filter(has_text='تعذر تحميل')).to_be_visible()
   expect(page.locator('tbody tr')).to_have_count(0)
   state['status']=200;page.get_by_role('link',name=f'إعادة تحميل {noun}',exact=True).click()
   expect(page.get_by_label(f'حالة {noun}',exact=True)).to_have_value('HELD' if tab=='refunds' else 'SENDING')
   checks.append(f'{tab}: outage is not an empty queue; retry preserves the filter')
   if tab=='refunds':
    text=page.locator('tbody tr').first.locator('td').nth(2).inner_text()
    assert '115' in text or '١١٥' in text,text
    checks.append('refund table includes add-ons in the total without adding shipping twice')
   state['status']=403;page.reload();expect(page.get_by_role('alert').filter(has_text='تفتقد صلاحية')).to_be_visible()
   checks.append(f'{tab}: permission refusal is explicit and no table operations are exposed')
  state['status']=200;page.goto('http://127.0.0.1:3003/ops/money?tab=payouts')
  page.set_viewport_size({'width':390,'height':844});action=page.get_by_role('button',name='التحقق من التحويل',exact=True)
  action.focus();expect(action).to_be_focused()
  assert page.evaluate('document.documentElement.scrollWidth<=390')
  box=action.bounding_box();assert box['x']>=0 and box['x']+box['width']<=391,box
  page.screenshot(path='.cache/audit/payout-confirmation-mobile.png',full_page=True)
  assert not errors,errors
  checks.append('390px page fits and keyboard focus reveals the verification action; no page exceptions')
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/payout-confirmation-ui.json').write_text(json.dumps({'scope':'Built web with isolated mock API; no real provider transfer','checks':checks},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'passed':len(checks)}))
