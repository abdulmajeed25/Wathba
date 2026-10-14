import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json

pid='9ebccf0d-3d08-407a-8d8a-a312b6921922';tid='fe0f488e-cadf-4e5d-b372-856e338b26d5'
state={'fee':750,'requires':True,'tiers':True,'posts':[],'updates':[],'reject':False}
def tier():return {'id':tid,'projectId':pid,'titleAr':'مكافأة الشحن','descAr':'وصف مكافأة للاختبار','amountHalalas':2005,'effectiveAmountHalalas':2005,'claimedQty':0,'limitQty':None,'requiresShipping':state['requires'],'shippingHalalas':state['fee'],'includedItems':[],'shipsTo':['SA'],'isActive':True,'estDeliveryDate':'2027-01-01T00:00:00Z'}
class Api(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send(self,data,status=200):
  self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_GET(self):
  path=self.path.split('?')[0]
  if path=='/v1/platform/status':self.send({'maintenance':False})
  elif path=='/v1/platform/pledge-policy': self.send({'minHalalas':1000,'maxHalalas':None,'methodsEnabled':{'card':True,'bnpl':True}})
  elif path==f'/v1/projects/{pid}':self.send({'id':pid,'titleAr':'حملة الشحن','createdBy':'ui-test','status':'DRAFT','applicationApprovedAt':'2026-10-14T00:00:00Z','fundingGoalHalalas':100000,'releaseThresholdPct':100,'category':'TECH','raisedHalalas':0,'backersCount':0})
  elif path==f'/v1/projects/{pid}/reward-tiers':self.send({'items':[tier()] if state['tiers'] else []})
  elif path==f'/v1/projects/{pid}/addons':self.send({'items':[]})
  elif path=='/v1/users/me':self.send({'id':'ui-test','name':'مدير اختبار','roles':['CREATOR'],'nafathVerified':True})
  elif path=='/v1/pledges/me/result':self.send({'id':'b651e7d5-f79a-4216-a599-f8795801040c','projectId':pid,'backerId':'ui-test','status':'PENDING_BNPL','amountHalalas':state['posts'][-1]['amountHalalas'],'addOnsHalalas':0,'createdAt':'2026-10-14T00:00:00Z','paymentRef':'pay-shipping'})
  else:self.send({},404)
 def do_POST(self):
  data=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
  if self.path=='/v1/pledges':
   state['posts'].append(data);self.send({'id':'b651e7d5-f79a-4216-a599-f8795801040c','paymentRef':'pay-shipping','status':'PENDING_BNPL'})
  else:self.send({})
 def do_PATCH(self):
  data=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
  state['updates'].append(data)
  if state['reject']:self.send({'message':'تكلفة الشحن تتجاوز الحد المعتمد من الإدارة'},400)
  else:state['fee']=data['shippingHalalas'];self.send(tier())

server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start()
checks=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':390,'height':844})
  context.add_cookies([{'name':'wathba_session','value':'ui-fixture-only','url':'http://127.0.0.1:3003'}])
  page=context.new_page()
  def back():page.goto(f'http://127.0.0.1:3003/projects/{pid}/back');page.wait_for_load_state('networkidle')
  def payment():
   while page.get_by_role('button',name='متابعة',exact=True).count():page.get_by_role('button',name='متابعة',exact=True).click()
   page.get_by_role('radio',name='طلب تقسيط عبر تابي',exact=True).click()
  back()
  Path('.cache/audit/shipping-checkout-dom.txt').write_text(page.locator('body').inner_text(),encoding='utf8')
  expect(page.get_by_text('27.55 ر.س',exact=True)).to_be_visible()
  assert 'استوديو أُفق' not in page.locator('body').inner_text()
  payment();page.get_by_role('button',name='تأكيد الدعم',exact=True).click()
  expect(page.get_by_role('alert').filter(has_text='عنوان شحن كامل')).to_be_visible()
  checks.append('missing shipping address error remains visible on information step')
  for label,value in [('الاسم الكامل','داعم اختبار'),('العنوان','شارع الاختبار مبنى 4'),('المدينة','الرياض'),('الرمز البريدي','12345')]:page.get_by_label(label,exact=True).fill(value)
  page.get_by_role('button',name='متابعة',exact=True).click()
  page.get_by_role('button',name='تأكيد الدعم',exact=True).click();page.wait_for_url('**/back/success?**')
  assert state['posts'][-1]['amountHalalas']==2755 and state['posts'][-1]['shippingHalalas']==750
  checks.append('20.05 reward plus 7.50 shipping posts exactly 27.55 without rounding or double addition')
  state['requires']=False;state['fee']=0;back();payment()
  page.get_by_role('button',name='تأكيد الدعم',exact=True).click();page.wait_for_url('**/back/success?**')
  assert state['posts'][-1]['amountHalalas']==2005 and state['posts'][-1]['shippingHalalas']==0
  checks.append('non-shipping reward has no fixed fee')
  state['requires']=True;state['fee']=None;back();payment();count=len(state['posts'])
  page.get_by_role('button',name='تأكيد الدعم',exact=True).click()
  expect(page.get_by_role('alert').filter(has_text='لم يحدد مدير الحملة')).to_be_visible();assert len(state['posts'])==count
  checks.append('unknown historical shipping blocks payment without assuming free shipping')
  state['tiers']=False;back();payment();page.get_by_role('button',name='تأكيد الدعم',exact=True).click();page.wait_for_url('**/back/success?**')
  assert state['posts'][-1]['amountHalalas']==2500 and 'tierId' not in state['posts'][-1] and state['posts'][-1]['shippingHalalas']==0
  checks.append('campaign with no reward tiers submits real tierless support')
  state['tiers']=True;state['fee']=750
  page.goto(f'http://127.0.0.1:3003/projects/dashboard/{pid}/rewards');page.wait_for_load_state('networkidle')
  Path('.cache/audit/shipping-manager-dom.txt').write_text(page.locator('body').inner_text(),encoding='utf8')
  field=page.get_by_label('تكلفة شحن مكافأة الشحن',exact=True)
  expect(field).to_have_value('7.5');field.fill('9.25')
  page.get_by_role('button',name='حفظ تكلفة الشحن',exact=True).click()
  expect(page.get_by_text('حُفظت تكلفة الشحن.',exact=True)).to_be_visible()
  assert state['updates'][-1]['shippingHalalas']==925
  page.reload();page.wait_for_load_state('networkidle');expect(field).to_have_value('9.25')
  checks.append('manager saves per-reward fee and reload displays persisted value')
  state['reject']=True;field.fill('999');page.get_by_role('button',name='حفظ تكلفة الشحن',exact=True).click()
  expect(page.get_by_text('تكلفة الشحن تتجاوز الحد المعتمد من الإدارة',exact=True)).to_be_visible()
  checks.append('administrator price rejection is visible and does not change stored fee')
  page.screenshot(path='.cache/audit/shipping-manager-mobile.png',animations='disabled',full_page=True)
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/shipping-ui.json').write_text(json.dumps({'scope':'Built web UI with isolated mock API; backend authorization and pricing tested separately on PostgreSQL','checks':checks},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'shipping_passed':len(checks)}))
