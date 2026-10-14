import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
import json

state={'status':200,'filters':[],'writes':0}
rows=[
 {'id':'7827aecf-d81e-4b73-ab57-e9cf7aa047fe','provider':'moyasar','eventType':'payment_paid','pspRef':'isolated-pending-payment','outcome':None,'processedAt':None,'createdAt':'2026-10-14T01:00:00Z'},
 {'id':'d7e8c5d6-eb4b-44ac-b957-2e23d4fbd4a1','provider':'moyasar','eventType':'payment_voided','pspRef':'isolated-completed-payment','outcome':'applied','processedAt':'2026-10-14T01:05:00Z','createdAt':'2026-10-14T01:00:00Z'},
]
class Api(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  path=urlparse(self.path).path;code=200
  if path=='/v1/platform/status':data={'maintenance':False}
  elif path=='/v1/users/me':data={'id':'isolated-ops-ui','name':'إدارة اختبار','roles':['ADMIN']}
  elif path=='/v1/ops/auth/session':data={'roleKeys':['OWNER'],'permissions':['*'],'fourEyes':True,'moneyAdmins':2}
  elif path=='/v1/ops/dashboard':data={'workQueue':{},'vitals':{}}
  elif path=='/v1/ops/alerts':data={'items':[]}
  elif path=='/v1/ops/money/webhook-events':
   assert self.headers.get('x-ops-token')=='isolated-ops-token'
   outcome=parse_qs(urlparse(self.path).query).get('outcome',[''])[0];state['filters'].append(outcome)
   code=state['status'];data={'items':rows[:1] if outcome=='pending' else rows,'nextCursor':None}
  else:code=404;data={}
  self.send_response(code);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_POST(self):state['writes']+=1;self.send_response(403);self.end_headers()

server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start()
checks=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':1440,'height':1000})
  context.add_cookies([{'name':n,'value':v,'url':'http://127.0.0.1:3003'} for n,v in [('wathba_session','isolated-admin-token'),('wathba_ops_session','isolated-ops-token')]])
  page=context.new_page();page.goto('http://127.0.0.1:3003/ops/money?tab=webhooks');page.wait_for_load_state('networkidle')
  expect(page.locator('table').get_by_text('لم تكتمل المعالجة',exact=True)).to_be_visible()
  expect(page.locator('table').get_by_text('تمت المعالجة',exact=True)).to_be_visible()
  checks.append('unfinished and applied events have distinct Arabic status labels')
  page.get_by_label('حالة إشعار الدفع',exact=True).select_option('pending');page.get_by_role('button',name='تصفية',exact=True).click()
  page.wait_for_url('**outcome=pending**');expect(page.locator('tbody tr')).to_have_count(1)
  assert state['filters'][-1]=='pending';checks.append('unfinished filter reaches the authenticated read endpoint and excludes completed events')
  page.screenshot(path='.cache/audit/webhook-recovery-desktop.png',full_page=True)
  state['status']=503;page.reload();expect(page.get_by_role('heading',name='تعذر تحميل إشعارات الدفع',exact=True)).to_be_visible()
  expect(page.get_by_text('لا أحداث مطابقة.',exact=True)).to_have_count(0)
  checks.append('backend outage displays failure instead of claiming an empty queue')
  state['status']=200;page.get_by_role('link',name='إعادة تحميل الإشعارات',exact=True).click()
  expect(page.locator('tbody tr')).to_have_count(1);expect(page.get_by_label('حالة إشعار الدفع',exact=True)).to_have_value('pending')
  checks.append('retry restores the queue and preserves the chosen filter')
  state['status']=403;page.reload();expect(page.get_by_role('alert').filter(has_text='لا يملك صلاحية')).to_be_visible()
  expect(page.get_by_role('button',name='إعادة تشغيل',exact=True)).to_have_count(0)
  checks.append('permission refusal shows an explicit access error and no replay controls')
  state['status']=200;page.reload();expect(page.locator('tbody tr')).to_have_count(1)
  page.set_viewport_size({'width':390,'height':844});page.screenshot(path='.cache/audit/webhook-recovery-mobile.png',full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth<=390')
  assert state['writes']==0
  checks.append('390px view stays within document width; all review actions remained read-only')
  replay=page.get_by_role('button',name='إعادة تشغيل',exact=True)
  replay.focus();expect(replay).to_be_focused()
  box=replay.bounding_box();assert box['x']>=0 and box['x']+box['width']<=390
  page.screenshot(path='.cache/audit/webhook-recovery-mobile-action.png',full_page=True)
  assert state['writes']==0
  checks.append('keyboard focus brings the replay control into view inside the horizontally scrollable mobile table without executing it')
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/webhook-recovery-ui.json').write_text(json.dumps({'scope':'Built web and isolated mock API; database recovery covered separately','checks':checks},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'passed':len(checks)}))
