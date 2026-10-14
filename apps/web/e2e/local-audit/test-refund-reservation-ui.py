import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
import json
state={'status':200,'filters':[],'writes':0}
base={'projectId':'22222222-2222-4222-8222-222222222222','backer':{'name':'داعم محلي','email':'a***@e***.com'},'amountHalalas':'10000','addOnsHalalas':'0','status':'CAPTURED','paymentMethod':'CARD','createdAt':'2026-10-14T00:00:00Z'}
rows=[dict(base,id='33333333-3333-4333-8333-333333333333',refundReservedHalalas='10000',refundRequestedAt='2026-10-14T00:00:00Z',refundIssue='refund-outcome-unknown'),dict(base,id='44444444-4444-4444-8444-444444444444',refundReservedHalalas='0',refundRequestedAt=None)]
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
   status=parse_qs(urlparse(self.path).query).get('status',[''])[0];state['filters'].append(status)
   self.send({'items':rows[:1] if status=='REFUND_PENDING' else rows,'nextCursor':None},state['status'])
  else:self.send({},404)
 def do_POST(self):state['writes']+=1;self.send({},403)
server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start()
checks=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':1440,'height':1000})
  context.add_cookies([{'name':n,'value':v,'url':'http://127.0.0.1:3003'} for n,v in [('wathba_session','isolated-admin-token'),('wathba_ops_session','isolated-ops-token')]])
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:3003/ops/money?tab=refunds');page.wait_for_load_state('networkidle')
  expect(page.locator('tbody tr')).to_have_count(2)
  pending=page.locator('tbody tr').first
  expect(pending.get_by_text('استرداد بانتظار المطابقة.',exact=False)).to_be_visible()
  expect(pending.get_by_text('استرداد قيد التحقق',exact=True)).to_be_visible()
  assert 'CAPTURED' not in pending.inner_text()
  expect(pending.get_by_role('button',name='استرداد',exact=True)).to_have_count(0)
  expect(page.get_by_role('button',name='استرداد',exact=True)).to_have_count(1)
  assert '100.00' in pending.inner_text() or '١٠٠' in pending.inner_text()
  checks.append('durable pending refund displays reserved money and hides resubmission while an untouched pledge stays actionable')
  page.get_by_label('حالة التعهدات',exact=True).select_option('REFUND_PENDING');page.get_by_role('button',name='تصفية',exact=True).click()
  page.wait_for_url('**status=REFUND_PENDING**');expect(page.locator('tbody tr')).to_have_count(1)
  assert state['filters'][-1]=='REFUND_PENDING';expect(page.get_by_role('button',name='استرداد',exact=True)).to_have_count(0)
  checks.append('pending filter reaches authenticated backend and excludes unreserved pledges')
  page.screenshot(path='.cache/audit/refund-reservation-desktop.png',full_page=True)
  page.reload();expect(page.get_by_text('استرداد بانتظار المطابقة.',exact=False)).to_be_visible()
  checks.append('pending state survives reload without relying on client memory')
  state['status']=503;page.reload();expect(page.get_by_role('alert').filter(has_text='تعذر تحميل')).to_be_visible()
  state['status']=200;page.get_by_role('link',name='إعادة تحميل التعهدات',exact=True).click()
  expect(page.get_by_label('حالة التعهدات',exact=True)).to_have_value('REFUND_PENDING')
  checks.append('outage recovery preserves pending-refund filter')
  page.set_viewport_size({'width':390,'height':844});warning=page.get_by_text('استرداد بانتظار المطابقة.',exact=False)
  warning.scroll_into_view_if_needed();expect(warning).to_be_visible()
  assert page.evaluate('document.documentElement.scrollWidth<=390')
  page.screenshot(path='.cache/audit/refund-reservation-mobile.png',full_page=True)
  assert state['writes']==0;assert not errors,errors
  checks.append('390px view retains warning inside scrollable table without writes or page exceptions')
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/refund-reservation-ui.json').write_text(json.dumps({'scope':'Built web and isolated mock API; PostgreSQL invariants verified separately','checks':checks},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'passed':len(checks)}))
