import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json

checks=[]; errors=[]; state={}; requests=[]
pid='11111111-1111-4111-8111-111111111111'
zero={'workQueue':{'milestonesSubmitted':0,'payoutsPending':0,'payoutsFailed':0,'pledgesCaptureGrace':0,'pledgesFailedCapture':0},'vitals':{'gmvHalalas':'0','pendingPayoutLiabilityHalalas':'0','refundCount':0}}
class Api(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  path=self.path.split('?')[0];requests.append(self.path);code=200
  if path in state:code,data=state[path]
  elif path=='/v1/platform/status':data={'maintenance':False}
  elif path=='/v1/users/me':data={'id':'local-owner','roles':['ADMIN','CREATOR'],'name':'اختبار'}
  elif path=='/v1/ops/auth/session':data={'roleKeys':['OWNER'],'permissions':['*'],'fourEyes':True,'moneyAdmins':2}
  elif path=='/v1/ops/dashboard':data=zero
  elif path=='/v1/ops/projects/stats':data={'statusCounts':{},'total':0}
  elif path in ['/v1/ops/alerts','/v1/ops/money/pledges','/v1/ops/projects','/v1/ops/operations',f'/v1/projects/{pid}/updates',f'/v1/projects/{pid}/comments']:data={'items':[],'nextCursor':None}
  elif path==f'/v1/projects/{pid}':data={'id':pid,'titleAr':'حملة اختبار القراءة','createdBy':'local-owner','status':'LIVE','applicationApprovedAt':'2026-10-01T00:00:00Z'}
  else:code=404;data={}
  self.send_response(code);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_POST(self):self.send_response(204);self.end_headers()
server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':1280,'height':900})
  context.add_cookies([{'name':n,'value':'local-fixture-only','url':'http://127.0.0.1:3003'} for n in ['wathba_session','wathba_ops_session']])
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  def go(path):page.goto('http://127.0.0.1:3003'+path);page.wait_for_load_state('networkidle')
  def tile(label):return page.get_by_text(label,exact=True).locator('..').locator('p').nth(1)
  state['/v1/ops/dashboard']=(503,{})
  go('/ops/money')
  expect(page.get_by_text('تعذر تحميل الملخص المالي. القيم غير المتاحة لا تعني صفرًا.',exact=True)).to_be_visible()
  expect(tile('إجمالي المبيعات (GMV)')).to_have_text('غير متاح');expect(tile('عدد الاستردادات')).to_have_text('غير متاح');checks.append('dashboard failure is unavailable, never a zero financial statement')
  del state['/v1/ops/dashboard'];page.get_by_role('button',name='إعادة تحميل البيانات',exact=True).click()
  expect(tile('إجمالي المبيعات (GMV)')).to_contain_text('0.00');expect(tile('عدد الاستردادات')).to_have_text('0');checks.append('financial retry reloads successful real zero values')
  state['/v1/ops/alerts']=(503,{})
  go('/ops/money');expect(page.get_by_text('تعذرت قراءة التنبيهات المالية؛ لا يمكن تأكيد خلو العمليات من المشكلات.',exact=True)).to_be_visible();expect(tile('نزاعات مفتوحة (DISPUTED)')).to_have_text('غير متاح');expect(tile('إجمالي المبيعات (GMV)')).to_contain_text('0.00');checks.append('failed alerts do not imply no disputes; available money remains visible')
  state['/v1/ops/alerts']=(200,{'items':None});go('/ops/money');expect(tile('نزاعات مفتوحة (DISPUTED)')).to_have_text('غير متاح');checks.append('invalid alerts envelope is unavailable')
  del state['/v1/ops/alerts'];state['/v1/ops/dashboard']=(200,{'vitals':{'gmvHalalas':'9007199254740993','pendingPayoutLiabilityHalalas':'bad','refundCount':-1}})
  go('/ops/money');expect(tile('إجمالي المبيعات (GMV)')).to_contain_text('90,071,992,547,409.93');expect(tile('التزام الدفعات المعلّقة')).to_have_text('غير متاح');expect(tile('عدد الاستردادات')).to_have_text('غير متاح');checks.append('large monetary amount retains exact halalas; corrupt money and counts are unknown')
  state['/v1/ops/dashboard']=(503,{});go('/ops/money?tab=refunds&status=DISPUTED');del state['/v1/ops/dashboard'];page.get_by_role('button',name='إعادة تحميل البيانات',exact=True).click();expect(page.get_by_text('تعذر تحميل الملخص المالي. القيم غير المتاحة لا تعني صفرًا.',exact=True)).not_to_be_visible();expect(page).to_have_url('http://127.0.0.1:3003/ops/money?tab=refunds&status=DISPUTED');checks.append('retry preserves financial tab and status filters')
  state['/v1/ops/dashboard']=(403,{});go('/ops/money');expect(page.get_by_role('alert').filter(has_text='تفتقد صلاحية')).to_be_visible();expect(page.get_by_text('إجمالي المبيعات (GMV)',exact=True)).not_to_be_visible();checks.append('refused money access shows permission message without financial tiles');del state['/v1/ops/dashboard']
  state['/v1/ops/projects']=(503,{});go('/ops/projects?q=fixture&status=LIVE')
  expect(page.get_by_text('تعذر تحميل المشاريع. لا يمكن تأكيد القائمة الآن.',exact=True)).to_be_visible();expect(page.get_by_text('لا مشاريع مطابقة للمرشحات',exact=True)).not_to_be_visible();checks.append('project list error does not claim an empty search')
  del state['/v1/ops/projects'];page.get_by_role('button',name='إعادة تحميل المشاريع',exact=True).click();expect(page.get_by_text('لا مشاريع مطابقة للمرشحات',exact=True)).to_be_visible();expect(page).to_have_url('http://127.0.0.1:3003/ops/projects?q=fixture&status=LIVE');checks.append('retry recovers true empty project list and preserves search filters')
  state['/v1/ops/projects']=(403,{});go('/ops/projects');expect(page.get_by_role('alert').filter(has_text='projects.review')).to_be_visible();expect(page.get_by_text('لا مشاريع مطابقة للمرشحات',exact=True)).not_to_be_visible();checks.append('refused project access never claims empty results')
  state['/v1/ops/projects']=(200,{'items':{}});go('/ops/projects');expect(page.get_by_text('تعذر تحميل المشاريع. لا يمكن تأكيد القائمة الآن.',exact=True)).to_be_visible();checks.append('invalid project envelope is not rendered as empty');del state['/v1/ops/projects']
  row={'id':pid,'titleAr':'مشروع متاح رغم تعطل الإحصاءات','status':'LIVE','categoryId':None,'categoryNameAr':None,'goalHalalas':'100000','raisedHalalas':'2005','realizedHalalas':'0','backersCount':1,'createdBy':'local-owner','createdById':'local-owner','hiddenAt':None,'openReportCount':0,'createdAt':'2026-10-01T00:00:00Z'}
  state['/v1/ops/projects']=(200,{'items':[row],'nextCursor':None});state['/v1/ops/projects/stats']=(503,{})
  go('/ops/projects');expect(page.get_by_text(row['titleAr'],exact=True)).to_be_visible();expect(page.get_by_text('إجمالي المشاريع',exact=True)).not_to_be_visible();expect(page.get_by_text('تعذر تحميل إحصاءات المشاريع؛ القائمة أدناه متاحة، والأعداد الإجمالية غير مؤكدة.',exact=True)).to_be_visible();checks.append('statistics outage preserves actual project list without invented totals')
  state['/v1/ops/projects/stats']=(200,{'total':1,'statusCounts':{'LIVE':1}});page.get_by_role('button',name='إعادة تحميل الإحصاءات',exact=True).click();expect(tile('إجمالي المشاريع')).to_have_text('1');checks.append('statistics retry restores verified count')
  for section,empty in [('updates','لم تنشر أي تحديث بعد.'),('comments','لا توجد تعليقات على هذه الحملة بعد.')]:
   api=f'/v1/projects/{pid}/{section}';state[api]=(503,{})
   go(f'/projects/dashboard/{pid}/{section}');expect(page.get_by_role('heading',name='تعذر تحميل مساحة المشروع',exact=True)).to_be_visible();expect(page.get_by_text(empty,exact=True)).not_to_be_visible();expect(page.get_by_placeholder('عنوان التحديث',exact=True)).not_to_be_visible();checks.append(f'{section} outage shows error boundary, no false empty or editor')
   del state[api];page.get_by_role('button',name='إعادة المحاولة',exact=True).click();expect(page.get_by_text(empty,exact=True)).to_be_visible(timeout=15000);checks.append(f'{section} retry reloads and shows verified empty content')
   state[api]=(200,{'items':None});go(f'/projects/dashboard/{pid}/{section}');expect(page.get_by_role('heading',name='تعذر تحميل مساحة المشروع',exact=True)).to_be_visible();checks.append(f'{section} malformed envelope fails visibly');del state[api]
  expected=[e for e in errors if 'Server Components render' in e]
  assert len(expected)==len(errors),errors
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/read-states-ui.json').write_text(json.dumps({'scope':'Built Next UI with isolated mock API; failure/empty/zero boundaries, not live backend acceptance','passed':len(checks),'checks':checks,'expectedServerComponentErrors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False))
