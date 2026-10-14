import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json

pid='9ebccf0d-3d08-407a-8d8a-a312b6921922';tid='fe0f488e-cadf-4e5d-b372-856e338b26d5'
state={'fee':750,'requires':True,'tiers':True,'posts':[],'updates':[],'reject':False,'countries':['SA','AE'],'policy':{'minHalalas':3550,'maxHalalas':5000,'methodsEnabled':{'card':False,'bnpl':True}},'policyFail':False}
def tier():return {'id':tid,'projectId':pid,'titleAr':'مكافأة الشحن','descAr':'وصف مكافأة للاختبار','amountHalalas':2005,'effectiveAmountHalalas':2005,'claimedQty':0,'limitQty':None,'requiresShipping':state['requires'],'shippingHalalas':state['fee'],'includedItems':[],'shipsTo':state['countries'],'isActive':True,'estDeliveryDate':'2027-01-01T00:00:00Z'}
class Api(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send(self,data,status=200):
  self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_GET(self):
  path=self.path.split('?')[0]
  if path=='/v1/platform/status':self.send({'maintenance':False})
  elif path=='/v1/platform/pledge-policy': self.send(state['policy'] if not state['policyFail'] else {},503 if state['policyFail'] else 200)
  elif path==f'/v1/projects/{pid}':self.send({'id':pid,'titleAr':'حملة الشحن','createdBy':'ui-test','status':'DRAFT','applicationApprovedAt':'2026-10-14T00:00:00Z','fundingGoalHalalas':100000,'releaseThresholdPct':100,'category':'TECH','raisedHalalas':0,'backersCount':0})
  elif path==f'/v1/projects/{pid}/reward-tiers':self.send({'items':[tier()] if state['tiers'] else []},503 if state.get('tiersFail') else 200)
  elif path==f'/v1/projects/{pid}/addons':self.send({'items':[]},503 if state.get('addonsFail') else 200)
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
  else:
   if 'shippingHalalas' in data:state['fee']=data['shippingHalalas']
   if 'shipsTo' in data:state['countries']=data['shipsTo']
   self.send(tier())

server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start()
checks=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':390,'height':844})
  context.add_cookies([{'name':'wathba_session','value':'ui-fixture-only','url':'http://127.0.0.1:3003'}])
  page=context.new_page()
  pending=set()
  page.on('request',lambda r:pending.add(r.url))
  page.on('requestfinished',lambda r:pending.discard(r.url))
  page.on('requestfailed',lambda r:pending.discard(r.url))
  def back():
   page.goto(f'http://127.0.0.1:3003/projects/{pid}/back')
   # The failed policy is already rendered while unrelated Next link
   # prefetches remain open. Wait for the relevant state, not global idleness.
   if state['policyFail']:expect(page.get_by_role('alert').filter(has_text='تعذر تحميل إعدادات')).to_be_visible()
   elif not any(state['policy']['methodsEnabled'].values()):expect(page.get_by_role('alert').filter(has_text='أوقفت الإدارة')).to_be_visible()
   else:expect(page.get_by_text('سقف المساهمة شاملًا الشحن: 50 ر.س',exact=True)).to_be_visible()
   while page.get_by_role('button',name='رجوع',exact=True).count():page.get_by_role('button',name='رجوع',exact=True).click()
  def advance():
   while page.get_by_role('button',name='متابعة',exact=True).count():page.get_by_role('button',name='متابعة',exact=True).click()
  def amount(value):
   back();page.get_by_test_id('no-reward-card').click();page.get_by_label('مبلغ الدعم',exact=True).fill(str(value));advance()
  def submit():page.get_by_role('button',name='تأكيد الدعم',exact=True).click()
  amount(20)
  assert page.get_by_role('radio',name='بطاقة',exact=True).count()==0
  expect(page.get_by_role('radio',name='طلب تقسيط عبر تابي',exact=True)).to_be_visible()
  submit();expect(page.get_by_role('alert').filter(has_text='35.5')).to_be_visible();assert len(state['posts'])==0
  checks.append('admin minimum 35.50 and disabled card are respected without submitting a pledge')
  amount(60);submit();expect(page.get_by_role('alert').filter(has_text='الحد الأقصى')).to_be_visible();assert len(state['posts'])==0
  checks.append('admin maximum 50 rejects 60 before payment submission')
  amount(40);state['policy']['minHalalas']=4500
  submit();expect(page.get_by_role('alert').filter(has_text='45')).to_be_visible();assert len(state['posts'])==0
  checks.append('policy is fetched again at confirmation and updated minimum is enforced')
  state['policy']['minHalalas']=3550
  amount(40);submit();page.wait_for_url('**/back/success?**');assert state['posts'][-1]['amountHalalas']==4000
  checks.append('valid amount submits exactly 4000 halalas via the enabled method')
  state['policyFail']=True;back();advance()
  expect(page.get_by_role('button',name='تأكيد الدعم',exact=True)).to_be_disabled()
  expect(page.get_by_role('alert').filter(has_text='تعذر تحميل إعدادات')).to_be_visible()
  state['policyFail']=False;page.get_by_role('button',name='إعادة تحميل الإعدادات').click()
  expect(page.get_by_role('radio',name='طلب تقسيط عبر تابي',exact=True)).to_be_visible()
  checks.append('policy outage blocks confirmation and explicit retry restores available methods')
  state['policy']['methodsEnabled']={'card':False,'bnpl':False};back();advance()
  expect(page.get_by_text('أوقفت الإدارة طرق الدفع حاليًا. يمكنك مراجعة تعهداتك السابقة.',exact=True)).to_be_visible()
  expect(page.get_by_role('button',name='تأكيد الدعم',exact=True)).to_be_disabled()
  checks.append('all methods disabled is an explicit unavailable state, not a usable card form')
  state['policy']['methodsEnabled']={'card':False,'bnpl':True};back()
  page.get_by_role('button',name='متابعة',exact=True).click()
  for label,value in [('الاسم الكامل','داعم اختبار'),('العنوان','شارع الاختبار مبنى 4'),('المدينة','دبي'),('الرمز البريدي','12345')]:page.get_by_label(label,exact=True).fill(value)
  page.get_by_label('الدولة',exact=True).select_option('AE');advance();submit();page.wait_for_url('**/back/success?**')
  assert state['posts'][-1]['shipping']['country']=='AE'
  checks.append('selected UAE destination is sent as AE rather than a hardcoded SA')
  state['countries']=[];back();page.get_by_role('button',name='متابعة',exact=True).click()
  for label,value in [('الاسم الكامل','داعم اختبار'),('العنوان','شارع الاختبار مبنى 4'),('المدينة','الرياض'),('الرمز البريدي','12345')]:page.get_by_label(label,exact=True).fill(value)
  advance();count=len(state['posts']);submit();expect(page.get_by_role('alert').filter(has_text='وجهات الشحن')).to_be_visible();assert len(state['posts'])==count
  checks.append('unknown historical destinations block new support without modifying old pledges')
  page.goto(f'http://127.0.0.1:3003/projects/dashboard/{pid}/rewards');page.wait_for_load_state('networkidle')
  field=page.get_by_label('وجهات شحن مكافأة الشحن',exact=True);field.fill('SA, AE')
  page.get_by_role('button',name='حفظ وجهات الشحن',exact=True).click();expect(page.get_by_text('حُفظت وجهات الشحن.',exact=True)).to_be_visible()
  page.reload();page.wait_for_load_state('networkidle');expect(field).to_have_value('SA, AE')
  checks.append('manager configures previously unknown destinations and reload shows persisted list')
  page.screenshot(path='.cache/audit/checkout-destinations-manager-mobile.png',full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth<=390')
  save_box=page.get_by_role('button',name='حفظ وجهات الشحن',exact=True).bounding_box()
  price_box=page.locator('label').filter(has_text='تكلفة الشحن (ريال)').bounding_box()
  assert save_box['y']+save_box['height']<=price_box['y']
  checks.append('390px shipping editor: labels and save buttons do not overlap and page has no horizontal overflow')
  for label in ['العنوان','السعر (ر.س)','الوصف','تاريخ التسليم المتوقع','دول الشحن (مفصولة بفاصلة)']:
   expect(page.get_by_label(label,exact=True)).to_be_visible()
  checks.append('reward creation inputs expose their visible Arabic labels to assistive tools')
  for key in ['tiersFail','addonsFail']:
   state[key]=True;page.reload();expect(page.get_by_role('heading',name='تعذر تحميل مساحة المشروع',exact=True)).to_be_visible()
   expect(page.get_by_text('لا توجد باقات بعد — أضف أوّل باقة من النموذج بجانبك.',exact=True)).to_have_count(0)
   state[key]=False;page.get_by_role('button',name='إعادة المحاولة',exact=True).click()
   expect(page.get_by_label('وجهات شحن مكافأة الشحن',exact=True)).to_have_value('SA, AE')
   checks.append(key+': failed read shows retry rather than false empty state; retry restores persisted rewards')
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/checkout-policy-ui.json').write_text(json.dumps({'scope':'Built web with isolated mock API; real database enforcement tested separately','checks':checks},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'checkout_policy_passed':len(checks)}))
