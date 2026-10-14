import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
import json

pid='33333333-3333-4333-8333-333333333333'
project='22222222-2222-4222-8222-222222222222'
row={'id':pid,'projectId':project,'backerId':'ui-test','amountHalalas':2000,'addOnsHalalas':0,'status':'PENDING_AUTH','paymentMethod':'CARD','createdAt':'2026-10-14T00:00:00Z','capturedAt':None,'refundedAt':None,'paymentRef':'11111111-1111-4111-8111-111111111111','projectTitleAr':'اختبار تحقق الحجز','authorizationRecoverable':True}
state={'outcome':'challenge','url':'https://api.moyasar.com/v1/transaction_auths/local-test','calls':[]}
checks=[];errors=[]
class Api(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send(self,data,code=200):
  self.send_response(code);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_GET(self):
  path=urlparse(self.path).path
  if path=='/v1/platform/status':self.send({'maintenance':False})
  elif path=='/v1/users/me':self.send({'id':'ui-test','name':'حساب اختبار','roles':['ADMIN']})
  elif path=='/v1/pledges/me/result':
   query=parse_qs(urlparse(self.path).query)
   if query.get('pledgeId',[None])[0]==pid or query.get('paymentRef',[None])[0]==row['paymentRef']:self.send(row)
   else:self.send({},404)
  elif path=='/v1/pledges/me':self.send({'items':[row]})
  elif path=='/v1/ops/auth/session':self.send({'roleKeys':['OWNER'],'permissions':['*'],'fourEyes':True,'moneyAdmins':2})
  elif path=='/v1/ops/dashboard':self.send({'workQueue':{},'vitals':{}})
  elif path=='/v1/ops/alerts':self.send({'items':[]})
  elif path=='/v1/ops/money/pledges':self.send({'items':[dict(row,amountHalalas='2000',addOnsHalalas='0',backer={'name':'اختبار','email':'a***@e***.com'},authorizationIssue='authorization-challenge')],'nextCursor':None})
  else:self.send({},404)
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
  if self.path=='/v1/events':self.send({'ok':True});return
  state['calls'].append(self.path)
  if self.path==f'/v1/pledges/{pid}/verify-authorization':
   assert self.headers.get('Authorization')=='Bearer ui-fixture-only'
   if state['outcome']=='unavailable':self.send({'message':'unavailable'},503);return
   if state['outcome'] in ['confirmed','uncharged']:
    row['status']='HELD' if state['outcome']=='confirmed' else 'FAILED';row['authorizationRecoverable']=False
   self.send({'outcome':state['outcome'],'transactionUrl':state['url']});return
  if '/money.authorization.reconcile/' in self.path:
   assert body['input']=={'pledgeId':pid}
   if self.path.endswith('/dry-run'):self.send({'ok':True,'blockers':[],'preview':{'summaryAr':'قراءة الحجز المحفوظ دون دفع جديد','before':None,'after':None}});return
   assert len(body['reason'])>=10 and self.headers.get('x-idempotency-key')
   self.send({'queued':True,'result':None} if state['outcome']=='queued' else {'result':{'outcome':state['outcome']}});return
  self.send({},400)

server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':390,'height':844})
  context.add_cookies([{'name':n,'value':'ui-fixture-only','url':'http://127.0.0.1:3003'} for n in ['wathba_session','wathba_ops_session']])
  context.route('https://api.moyasar.com/**',lambda route:route.abort())
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('response',lambda response: print('verification response',response.status,response.text()) if '/verify-authorization' in response.url and response.status!=200 else None)
  def visit(ref=pid):
   page.goto(f'http://127.0.0.1:3003/projects/{project}/back/success?pledge={ref}&ref={row["paymentRef"] if ref==pid else "someone-else"}&status=paid');page.wait_for_load_state('networkidle')
  visit();bank=page.get_by_role('link',name='إكمال التحقق لدى البنك',exact=True)
  expect(bank).to_have_attribute('href',state['url']);expect(page.get_by_role('heading',level=1)).to_have_text('جارٍ التحقق من حالة الدعم')
  assert len(state['calls'])==1;checks.append('callback paid query is not success; one verification exposes the same bank challenge')
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':900})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
   for control in [bank,page.get_by_role('button',name='التحقق من الحجز',exact=True)]:
    box=control.bounding_box();assert box['x']>=0 and box['x']+box['width']<=width+1 and box['height']>=44,(width,box)
   checks.append(f'authorization controls fit {width}px and have 44px targets')
  page.set_viewport_size({'width':390,'height':844});page.screenshot(path='.cache/audit/authorization-return-mobile.png',full_page=True)
  state['url']='https://evil.example/bank';page.get_by_role('button',name='التحقق من الحجز',exact=True).click();expect(bank).to_have_count(0)
  expect(page.get_by_role('region',name='متابعة حجز الدفع')).to_contain_text('لم يصل رابط صالح');checks.append('untrusted challenge URL never becomes a link')
  state['outcome']='unavailable';page.get_by_role('button',name='التحقق من الحجز',exact=True).click();expect(page.get_by_role('region',name='متابعة حجز الدفع')).to_contain_text('لا تدفع مجددًا');checks.append('provider outage remains pending and discourages another payment')
  state['outcome']='needs-review';page.get_by_role('button',name='التحقق من الحجز',exact=True).click();expect(page.get_by_role('region',name='متابعة حجز الدفع')).to_contain_text('شروط الحملة');checks.append('changed terms explain review instead of success')
  for result,heading in [('confirmed','تم تسجيل دعمك'),('uncharged','لم يكتمل الدفع')]:
   row.update(status='PENDING_AUTH',authorizationRecoverable=True);state['outcome']=result;visit()
   expect(page.get_by_role('heading',level=1)).to_have_text(heading);expect(page.get_by_role('region',name='متابعة حجز الدفع')).to_have_count(0)
   checks.append(f'{result} refreshes server truth and removes recovery controls')
  row.update(status='PENDING_AUTH',authorizationRecoverable=False);before=len(state['calls']);visit();expect(page.get_by_role('region',name='متابعة حجز الدفع')).to_have_count(0);assert len(state['calls'])==before;checks.append('legacy pledge without context never triggers automatic recovery')
  row['authorizationRecoverable']=True;visit('someone-else');expect(page.get_by_role('region',name='متابعة حجز الدفع')).to_have_count(0);assert len(state['calls'])==before;checks.append('unowned or missing callback pledge never triggers verification')
  state.update(outcome='challenge',url='https://api.moyasar.com/v1/transaction_auths/local-test')
  page.goto('http://127.0.0.1:3003/projects/me/pledges');page.wait_for_load_state('networkidle');assert len(state['calls'])==before
  page.get_by_role('button',name='التحقق من الحجز',exact=True).click();expect(bank).to_be_visible();checks.append('backer can resume manually from pledge list without automatic API calls')
  page.screenshot(path='.cache/audit/authorization-backer-mobile.png',full_page=True)
  for origin,status in [('https://evil.example',403),('http://127.0.0.1:3003',200)]:
   response=context.request.post(f'http://127.0.0.1:3003/api/pledges/{pid}/verify-authorization',headers={'Origin':origin});assert response.status==status,(origin,response.status)
  checks.append('proxy rejects external origin and accepts the authenticated same-origin request')
  page.set_viewport_size({'width':1440,'height':1000});page.goto('http://127.0.0.1:3003/ops/money?tab=refunds&status=PENDING_AUTH');page.wait_for_load_state('networkidle')
  def op():
   page.get_by_role('button',name='التحقق من الحجز الأول',exact=True).click()
   expect(page.get_by_text('قراءة الحجز المحفوظ دون دفع جديد',exact=True)).to_be_visible()
   expect(page.get_by_role('button',name='تنفيذ العملية المالية',exact=True)).to_be_disabled()
   page.get_by_label('السبب (10 أحرف على الأقل — يُسجَّل في التدقيق)',exact=True).fill('التحقق من حجز اختبار محلي')
   page.get_by_label('عملية مالية — اكتب «نعم» للتأكيد',exact=True).fill('نعم')
   page.get_by_role('button',name='تنفيذ العملية المالية',exact=True).click()
  op();expect(page.get_by_role('dialog')).to_contain_text('يلزم الداعم إكمال تحقق البنك');expect(bank).to_have_count(0);page.get_by_role('button',name='تم',exact=True).click();checks.append('administrator verification requires confirmation and never exposes bank challenge')
  state['outcome']='queued';op();expect(page.get_by_role('dialog')).to_contain_text('لم يُنفذ بعد');checks.append('second approval queue is not reported as completed authorization')
  assert not errors,errors
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/authorization-ui.json').write_text(json.dumps({'scope':'Built Next UI with isolated mocked API; not live payment provider','passed':len(checks),'checks':checks,'pageErrors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False))
