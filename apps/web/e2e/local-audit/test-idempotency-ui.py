import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json

pid='9ebccf0d-3d08-407a-8d8a-a312b6921922'
tid='fe0f488e-cadf-4e5d-b372-856e338b26d5'
state={'posts':[], 'events':[], 'replay':True, 'status':'HELD'}
class Api(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def send(self,data,status=200):
  self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_GET(self):
  path=self.path.split('?')[0]
  if path=='/v1/platform/status': self.send({'maintenance':False})
  elif path=='/v1/platform/pledge-policy': self.send({'minHalalas':1000,'maxHalalas':None,'methodsEnabled':{'card':True,'bnpl':True}})
  elif path==f'/v1/projects/{pid}': self.send({'id':pid,'titleAr':'حملة اختبار إعادة المحاولة'})
  elif path==f'/v1/projects/{pid}/reward-tiers': self.send({'items':[{'id':tid,'titleAr':'مكافأة اختبار','descAr':'وصف اختبار','amountHalalas':2000,'claimedQty':0,'requiresShipping':False}]})
  elif path=='/v1/pledges/me/result': self.send({'id':'b651e7d5-f79a-4216-a599-f8795801040c','projectId':pid,'backerId':'ui-test','amountHalalas':2800,'addOnsHalalas':0,'status':state['status'],'createdAt':'2026-10-14T00:00:00.000Z','paymentRef':'pay-ui','projectTitleAr':'حملة اختبار'})
  elif path=='/v1/users/me': self.send({'id':'ui-test','name':'Test','roles':['BACKER']})
  else:self.send({},404)
 def do_POST(self):
  data=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
  if self.path=='/v1/pledges':
   state['posts'].append(data);self.send({'id':'b651e7d5-f79a-4216-a599-f8795801040c','status':state['status'],'paymentRef':'pay-ui','replayed':state['replay']})
  elif self.path=='/v1/events':state['events'].append(data);self.send({})
  else:self.send({})
server=ThreadingHTTPServer(('127.0.0.1',4000),Api)
Thread(target=server.serve_forever,daemon=True).start()
checks=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':390,'height':844})
  context.add_cookies([{'name':'wathba_session','value':'ui-fixture-only','url':'http://127.0.0.1:3003'}])
  page=context.new_page()
  page.on('pageerror',lambda error: print(str(error),flush=True))
  page.goto(f'http://127.0.0.1:3003/projects/{pid}/back');page.wait_for_load_state('networkidle')
  Path('.cache/audit/idempotency-ui-dom.txt').write_text(page.locator('body').inner_text(),encoding='utf8')
  print(json.dumps(page.get_by_role('button').all_text_contents(),ensure_ascii=True))
  def to_payment():
   while page.get_by_role('button',name='متابعة',exact=True).count():page.get_by_role('button',name='متابعة',exact=True).click()
   page.get_by_role('radio',name='طلب تقسيط عبر تابي',exact=True).click()
  to_payment()
  attempts=[]
  def lost(route):
   attempts.append(route.request.post_data_json);route.abort('connectionreset')
  page.route('**/api/pledges',lost)
  page.get_by_role('button',name='تأكيد الدعم',exact=True).click()
  expect(page.get_by_text('انقطع الاتصال قبل التأكد من النتيجة.',exact=False)).to_be_visible()
  first=attempts[0]['requestKey'];assert len(first)==36
  page.get_by_role('button',name='تأكيد الدعم',exact=True).click()
  expect(page.get_by_text('انقطع الاتصال قبل التأكد من النتيجة.',exact=False)).to_be_visible()
  assert len(attempts)==2 and attempts[1]['requestKey']==first
  checks.append('same key after lost response and immediate retry')
  page.reload();page.wait_for_load_state('networkidle');to_payment()
  page.get_by_role('button',name='تأكيد الدعم',exact=True).click()
  expect(page.get_by_text('انقطع الاتصال قبل التأكد من النتيجة.',exact=False)).to_be_visible()
  assert attempts[-1]['requestKey']==first
  checks.append('same key after browser reload')
  assert page.evaluate('(key)=>sessionStorage.getItem(key)',f'wathba_pledge_request_{pid}')==first
  checks.append('storage contains only opaque request identifier')
  page.unroute('**/api/pledges',lost)
  before=sum(e.get('name')=='pledge_completed' for e in state['events'])
  page.get_by_role('button',name='تأكيد الدعم',exact=True).click()
  page.wait_for_url('**/back/success?**');page.wait_for_load_state('networkidle')
  expect(page.get_by_role('heading',name='تم تسجيل دعمك',exact=True)).to_be_visible()
  assert state['posts'][-1]['requestKey']==first
  assert sum(e.get('name')=='pledge_completed' for e in state['events'])==before
  checks.append('replay does not emit a duplicate pledge_completed event')
  assert page.evaluate('(key)=>sessionStorage.getItem(key)',f'wathba_pledge_request_{pid}') is None
  checks.append('confirmed replay opens verified result and clears completed attempt')
  def read_ancestors():
   return page.get_by_role('heading',name='تم تسجيل دعمك',exact=True).evaluate("el => {const rows=[];for(let e=el;e;e=e.parentElement){const s=getComputedStyle(e);rows.push({tag:e.tagName,cls:e.className,opacity:s.opacity,color:s.color,animation:s.animation,style:e.getAttribute('style')})}return rows}")
  Path('.cache/audit/result-opacity-before.json').write_text(json.dumps(read_ancestors(),ensure_ascii=False,indent=2),encoding='utf8')
  page.wait_for_function("() => {const el=document.querySelector('h1');for(let e=el;e;e=e.parentElement){if(Number(getComputedStyle(e).opacity)<.99)return false}return Boolean(el)}",timeout=10000)
  page.screenshot(path='.cache/audit/idempotency-ui-mobile.png', animations='disabled')
  Path('.cache/audit/result-opacity-after.json').write_text(json.dumps(read_ancestors(),ensure_ascii=False,indent=2),encoding='utf8')
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
  checks.append('result fits 390px viewport')
  state['status']='PENDING_AUTH'
  page.goto(f'http://127.0.0.1:3003/projects/{pid}/back');page.wait_for_load_state('networkidle');to_payment()
  page.get_by_role('button',name='تأكيد الدعم',exact=True).click()
  page.wait_for_url('**/back/success?**');page.wait_for_load_state('networkidle')
  expect(page.get_by_role('heading',name='جارٍ التحقق من حالة الدعم',exact=True)).to_be_visible()
  assert page.evaluate('(key)=>sessionStorage.getItem(key)',f'wathba_pledge_request_{pid}')==state['posts'][-1]['requestKey']
  checks.append('pending replay remains unconfirmed and preserves attempt key')
  page.goto(f'http://127.0.0.1:3003/projects/{pid}/back');page.wait_for_load_state('networkidle');to_payment()
  page.evaluate("() => { Storage.prototype.setItem=function(){throw new Error('storage denied')}; }")
  count=len(state['posts'])
  page.get_by_role('button',name='تأكيد الدعم',exact=True).click()
  expect(page.get_by_text('تعذر حفظ معرّف محاولة الدفع في المتصفح.',exact=False)).to_be_visible()
  assert len(state['posts'])==count
  checks.append('unavailable session storage prevents unsafe submission')
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/idempotency-ui.json').write_text(json.dumps({'scope':'Built web with isolated mock API; PostgreSQL and provider-call counts verified separately','checks':checks},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'passed':len(checks)}))
