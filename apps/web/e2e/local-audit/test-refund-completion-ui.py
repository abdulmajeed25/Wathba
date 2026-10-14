import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json

pid='9ebccf0d-3d08-407a-8d8a-a312b6921922'
state={'status':'LIVE','result':'refund_pending','response':200,'posts':0,'reads':[]}
class Api(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send(self,data,status=200):
  self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_GET(self):
  path=self.path.split('?')[0];state['reads'].append(path)
  if path=='/v1/platform/status':self.send({'maintenance':False})
  elif path=='/v1/users/me':self.send({'id':'ui-test','name':'مدير اختبار','roles':['CREATOR'],'nafathVerified':True})
  elif path==f'/v1/projects/{pid}':self.send({'id':pid,'titleAr':'حملة اختبار الإلغاء','shortDescAr':'حملة محلية وهمية للاختبار فقط','createdBy':'ui-test','status':state['status'],'applicationApprovedAt':'2026-10-14T00:00:00Z','fundingGoalHalalas':100000,'releaseThresholdPct':100,'category':'TECH','raisedHalalas':1800,'backersCount':1,'durationDays':30,'deadline':'2027-01-01T00:00:00Z','storyAr':'لا توجد مبالغ حقيقية','tags':[]})
  elif 'change-request' in path:self.send({'items':[],'nextCursor':None})
  else:self.send({},404)
 def do_POST(self):
  self.rfile.read(int(self.headers.get('Content-Length','0')))
  if self.path!=f'/v1/projects/{pid}/cancel':self.send({},404);return
  assert self.headers.get('Authorization')=='Bearer ui-fixture-only'
  state['posts']+=1
  if state['response']!=200:self.send({'message':'تعذر تنفيذ الإلغاء؛ راجع الإدارة'},state['response']);return
  state['status']='FAILED' if state['result']=='refund_pending' else 'REFUNDED' if state['result']=='refunded' else 'DRAFT'
  self.send({'projectId':pid,'outcome':state['result']})

server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start()
checks=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':1440,'height':1000})
  context.add_cookies([{'name':'wathba_session','value':'ui-fixture-only','url':'http://127.0.0.1:3003'}])
  page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  def visit():
   page.goto(f'http://127.0.0.1:3003/projects/dashboard/{pid}/settings');page.wait_for_load_state('networkidle')
  def arm():
   page.get_by_role('button',name='إلغاء الحملة وبدء إعادة المبالغ',exact=True).click()
   confirm=page.get_by_role('button',name='تأكيد إلغاء الحملة',exact=True)
   expect(confirm).to_be_disabled()
   page.get_by_label('اكتب اسم الحملة للتأكيد',exact=True).fill('حملة اختبار الإلغاء')
   expect(confirm).to_be_enabled();return confirm
  visit();confirm=arm()
  assert 'سيقوم النظام تلقائياً بإرجاع كامل المبالغ' not in page.locator('body').inner_text()
  expect(page.get_by_text('إجراء لا يمكن التراجع عنه',exact=True)).to_be_visible()
  checks.append('LIVE confirmation describes processing instead of guaranteed immediate refunds and requires the campaign title')
  confirm.click()
  expect(page.get_by_role('status').filter(has_text='ما زالت بعض عمليات')).to_be_visible()
  expect(page.get_by_text('انتهت الحملة ولم تُعتمد إعادة جميع المبالغ.',exact=False)).to_be_visible()
  assert state['posts']==1
  checks.append('refund_pending response persists FAILED status and displays pending reconciliation after refresh')
  page.reload();expect(page.get_by_text('انتهت الحملة ولم تُعتمد إعادة جميع المبالغ.',exact=False)).to_be_visible()
  assert 'الأموال سُوّيت بالفعل' not in page.locator('body').inner_text()
  checks.append('reload preserves the unresolved status without claiming financial settlement')
  state['status']='LIVE';state['result']='refunded';visit();arm().click()
  expect(page.get_by_role('status').filter(has_text='اكتملت إعادة التعهدات')).to_be_visible()
  checks.append('confirmed completion has a distinct success message')
  state['status']='PAUSED';state['response']=503;visit();confirm=arm();confirm.click()
  expect(page.get_by_role('alert').filter(has_text='تعذر تنفيذ الإلغاء')).to_be_visible()
  assert state['status']=='PAUSED';checks.append('PAUSED campaign has the same confirmation gate and provider/API failure does not claim success')
  state['response']=403;confirm.click();expect(page.get_by_role('alert').filter(has_text='تعذر تنفيذ الإلغاء')).to_be_visible()
  assert state['status']=='PAUSED';checks.append('authorization refusal remains visible without changing the campaign state')
  state['response']=200;state['result']='withdrawn';state['status']='SCHEDULED';visit()
  page.get_by_role('button',name='إلغاء موعد النشر',exact=True).click()
  expect(page.get_by_label('اكتب اسم الحملة للتأكيد',exact=True)).to_have_count(0)
  page.get_by_role('button',name='تأكيد إلغاء الموعد',exact=True).click()
  expect(page.get_by_role('status').filter(has_text='حُفظ التغيير.')).to_be_visible()
  assert state['status']=='DRAFT';checks.append('scheduled campaign withdrawal returns to DRAFT without claiming a money refund')
  state['status']='PAUSED';visit();page.set_viewport_size({'width':390,'height':844});confirm=arm()
  confirm.scroll_into_view_if_needed();expect(confirm).to_be_visible()
  assert page.evaluate('document.documentElement.scrollWidth <= 390')
  page.screenshot(path='.cache/audit/refund-cancel-mobile.png',full_page=False)
  checks.append('390px Arabic confirmation fits the viewport and exposes the enabled action')
  page.set_viewport_size({'width':1440,'height':1000});confirm.scroll_into_view_if_needed()
  page.screenshot(path='.cache/audit/refund-cancel-desktop.png',full_page=False)
  assert not errors,errors
  checks.append('no browser page exceptions during the tested transitions')
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/refund-completion-ui.json').write_text(json.dumps({'scope':'Built web and isolated mock API; PostgreSQL tests separately verify accounting','checks':checks},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'passed':len(checks)}))
