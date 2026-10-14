import os,json
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright,expect

pid='11111111-1111-4111-8111-111111111111';uid='22222222-2222-4222-8222-222222222222'
state={'user':'editor','granted':False,'readFail':False,'writeFail':False,'teamFail':False,'inviteFail':False,'removeFail':False,'team':[]}
row={'id':uid,'projectId':pid,'orderNum':1,'titleAr':'تحديث مجدول للفريق','bodyAr':'نص خاص يراه المحرر','visibility':'BACKERS_ONLY','publishAt':'2030-01-01T00:00:00Z','date':'2026-10-01T00:00:00Z','scheduled':True,'locked':False,'pinned':False,'likeCount':0,'commentCount':0}
rows=[row];checks=[];errors=[];writes=[];reads=[]
workspace={'id':pid,'titleAr':'حملة مساحة المحتوى','status':'DRAFT','role':'EDITOR'}
class Api(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send(self,data,code=200):
  self.send_response(code);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_GET(self):
  path=self.path.split('?')[0];reads.append(path)
  if path=='/v1/platform/status':self.send({'maintenance':False})
  elif path=='/v1/users/me':self.send({'id':state['user'],'name':'اختبار مساحة المحتوى','roles':['BACKER'],'createdProjectsCount':1 if state['user']=='owner' else 0})
  elif path=='/v1/content-workspaces':self.send({'items':[workspace] if state['granted'] else []})
  elif path==f'/v1/content-workspaces/{pid}':self.send(workspace if state['granted'] else {},200 if state['granted'] else 404)
  elif path==f'/v1/projects/{pid}/updates':self.send({'items':rows} if not state['readFail'] else {},200 if not state['readFail'] else 503)
  elif path==f'/v1/projects/{pid}/collaborators':self.send({'items':state['team']} if not state['teamFail'] else {},200 if not state['teamFail'] else 503)
  elif path==f'/v1/projects/{pid}':self.send({**workspace,'createdBy':'owner','applicationApprovedAt':'2026-10-01T00:00:00Z','storyAr':'حملة للاختبار فقط '*30,'shortDescAr':'اختبار','category':'TECH','fundingGoalHalalas':100000,'releaseThresholdPct':80,'durationDays':30,'deadline':'2026-11-01T00:00:00Z','backersCount':0,'raisedHalalas':0,'mediaUrls':[]})
  elif path in ['/v1/projects/mine','/v1/tags','/v1/notifications']:self.send({'items':[]})
  elif path=='/v1/categories':self.send([])
  else:self.send({},404)
 def do_POST(self):self.mutate('POST')
 def do_PATCH(self):self.mutate('PATCH')
 def do_DELETE(self):self.mutate('DELETE')
 def mutate(self,method):
  path=self.path.split('?')[0];raw=self.rfile.read(int(self.headers.get('content-length','0')));body=json.loads(raw) if raw else {};writes.append({'method':method,'path':path,'body':body})
  if '/collaborators' in path:
   if method=='POST':
    if state['inviteFail']:self.send({'message':'لا يوجد مستخدم بهذا البريد على وثبة'},404);return
    state['team']=[{'userId':'editor','name':'محرر الفريق','email':body['email'],'role':'EDITOR','addedAt':'2026-10-01T00:00:00Z'}];self.send({'items':state['team']});return
   if method=='DELETE':
    if state['removeFail']:self.send({},503);return
    state['team']=[];self.send({'removed':True});return
  if '/updates' in path:
   if not state['granted']:self.send({'message':'لا تملك صلاحية تحرير تحديثات هذه الحملة'},403);return
   if state['writeFail']:self.send({'message':'تعذر الحفظ مؤقتًا'},503);return
   if method=='POST':
    item={**row,**body,'id':'33333333-3333-4333-8333-333333333333','orderNum':2,'scheduled':bool(body.get('publishAt'))};rows.insert(0,item);self.send(item,201);return
   item=next(r for r in rows if r['id'] in path)
   if path.endswith('/pin'):item['pinned']=not item['pinned'];self.send(item);return
   if method=='PATCH':item.update(body);self.send(item);return
   if method=='DELETE':rows.remove(item);self.send({'ok':True});return
  self.send({},404)
server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  anonymous=browser.new_context()
  for path in ['/projects/dashboard/collaborations',f'/projects/dashboard/collaborations/{pid}']:
   response=anonymous.request.get('http://127.0.0.1:3003'+path,max_redirects=0)
   assert response.status==307 and '/sign-in?' in response.headers['location']
  anonymous.close();checks.append('anonymous list and workspace requests require sign-in')
  context=browser.new_context(viewport={'width':390,'height':844})
  context.add_cookies([{'name':'wathba_session','value':'fixture-only','url':'http://127.0.0.1:3003'}])
  for path in [f'/projects/dashboard/{pid}','/projects/dashboard/collaborations-other']:
   response=context.request.get('http://127.0.0.1:3003'+path,max_redirects=0)
   assert response.status==307 and response.headers['location'].endswith('/projects/start')
  checks.append('editor exception does not unlock owner dashboard or similarly named paths')
  page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
  def go(path):page.goto('http://127.0.0.1:3003'+path,wait_until='domcontentloaded')
  go('/projects/dashboard/collaborations');expect(page.get_by_role('heading',name='لا توجد مساحات متاحة لك الآن',exact=True)).to_be_visible();checks.append('backer account can reach a truthful empty editorial workspace list')
  state['granted']=True;page.reload();page.get_by_role('link',name='فتح مساحة المحتوى',exact=True).click()
  expect(page.get_by_role('heading',name='الحملة في مرحلة التجهيز',exact=True)).to_be_visible();expect(page.get_by_text('نص خاص يراه المحرر',exact=True)).to_be_visible()
  assert f'/v1/projects/{pid}' not in reads;expect(page.get_by_role('link',name='الدفعات',exact=True)).not_to_be_visible();checks.append('editor opens private scheduled content through minimal workspace without full project or money reads')
  article=page.locator('article').filter(has=page.get_by_role('heading',name='تحديث مجدول للفريق',exact=True));article.get_by_role('button',name='تعديل',exact=True).click()
  expect(page.get_by_label('عنوان التحديث',exact=True)).to_be_focused();page.get_by_label('عنوان التحديث',exact=True).fill('تحديث عُدّل في المساحة');state['writeFail']=True
  page.get_by_role('button',name='حفظ التعديل',exact=True).click();expect(page.get_by_role('alert').filter(has_text='تعذر الحفظ مؤقتًا')).to_be_visible();expect(page.get_by_label('عنوان التحديث',exact=True)).to_have_value('تحديث عُدّل في المساحة');expect(article).to_be_visible();checks.append('failed edit preserves entered text and original saved row')
  state['writeFail']=False;page.get_by_role('button',name='حفظ التعديل',exact=True).click();expect(page.get_by_role('heading',name='تحديث عُدّل في المساحة',exact=True)).to_be_visible();expect(page.get_by_role('status').filter(has_text='حُفظ تعديل التحديث.')).to_be_visible();assert 'publishAt' not in writes[-1]['body'];checks.append('successful edit persists through PATCH without changing schedule')
  page.get_by_label('عنوان التحديث',exact=True).fill('تحديث جديد');page.get_by_label('محتوى التحديث',exact=True).fill('نص جديد محفوظ');page.get_by_label('من يرى التحديث؟').select_option('BACKERS_ONLY');page.get_by_role('button',name='نشر التحديث',exact=True).click();expect(page.get_by_role('heading',name='تحديث جديد',exact=True,level=3)).to_be_visible();assert writes[-1]['method']=='POST';checks.append('new restricted update saves and joins the list')
  latest=page.locator('article').filter(has=page.get_by_role('heading',name='تحديث جديد',exact=True,level=3));state['writeFail']=True;latest.get_by_role('button',name='تثبيت',exact=True).click();expect(page.get_by_role('alert').filter(has_text='تعذّر تغيير التثبيت')).to_be_visible();expect(latest.get_by_role('button',name='تثبيت',exact=True)).to_be_visible();checks.append('failed pin keeps saved state and reports failure')
  state['writeFail']=False;latest.get_by_role('button',name='تثبيت',exact=True).click();expect(latest.get_by_role('button',name='إلغاء التثبيت',exact=True)).to_be_visible();checks.append('confirmed pin updates only after success')
  for control in latest.get_by_role('button').all():assert control.bounding_box()['height']>=44
  assert page.locator('main').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1');page.screenshot(path='.cache/audit/content-workspace-mobile.png',full_page=True,animations='disabled');checks.append('mobile editorial controls fit and have 44px heights')
  latest.get_by_role('button',name='تعديل',exact=True).click();page.get_by_label('محتوى التحديث',exact=True).fill('نص لا يضيع بعد سحب الإذن');state['granted']=False;page.get_by_role('button',name='حفظ التعديل',exact=True).click();expect(page.get_by_role('alert').filter(has_text='لا تملك صلاحية')).to_be_visible();expect(page.get_by_label('محتوى التحديث',exact=True)).to_have_value('نص لا يضيع بعد سحب الإذن');checks.append('revoked edit is rejected while preserving unsaved text')
  page.reload();expect(page.get_by_role('heading',name='مساحة المحتوى غير متاحة',exact=True)).to_be_visible();expect(page.get_by_label('عنوان التحديث',exact=True)).not_to_be_visible();checks.append('reloading a revoked workspace removes editor and explains access state')
  state['granted']=True;state['readFail']=True;go(f'/projects/dashboard/collaborations/{pid}');expect(page.get_by_role('heading',name='تعذر تحميل مساحة المشروع',exact=True)).to_be_visible();state['readFail']=False;page.get_by_role('button',name='إعادة المحاولة',exact=True).click();expect(page.get_by_role('heading',name='تحديث جديد',exact=True,level=3)).to_be_visible();checks.append('updates outage uses error boundary and retry restores saved content')
  state['user']='owner';state['teamFail']=True;go(f'/projects/dashboard/{pid}/settings')
  expect(page.get_by_text('تعذرت قراءة الفريق؛ لا يمكن تأكيد الأعضاء الحاليين.',exact=True)).to_be_visible();expect(page.get_by_text('لا يوجد متعاونون بعد.',exact=True)).not_to_be_visible();checks.append('team read failure never claims no members')
  state['teamFail']=False;page.get_by_role('button',name='إعادة تحميل الفريق',exact=True).click();expect(page.get_by_text('لا يوجد متعاونون بعد.',exact=True)).to_be_visible();checks.append('team retry recovers verified empty membership')
  page.get_by_label('بريد المتعاون',exact=True).fill('editor@local.test');state['inviteFail']=True;page.get_by_role('button',name='إضافة',exact=True).click();expect(page.get_by_role('alert').filter(has_text='لا يوجد مستخدم بهذا البريد')).to_be_visible();expect(page.get_by_label('بريد المتعاون',exact=True)).to_have_value('editor@local.test');checks.append('failed invitation preserves email and displays server reason')
  state['inviteFail']=False;page.get_by_role('button',name='إضافة',exact=True).click();expect(page.get_by_text('محرر الفريق',exact=True)).to_be_visible();expect(page.get_by_role('status').filter(has_text='أُضيف محرر التحديثات')).to_be_visible();checks.append('successful invitation shows member and their entry route')
  state['removeFail']=True;page.get_by_role('button',name='إزالة',exact=True).click();expect(page.get_by_role('alert').filter(has_text='تعذّر سحب الوصول')).to_be_visible();expect(page.get_by_text('محرر الفريق',exact=True)).to_be_visible();checks.append('failed removal retains member and never claims revoked access')
  state['removeFail']=False;page.get_by_role('button',name='إزالة',exact=True).click();expect(page.get_by_text('محرر الفريق',exact=True)).not_to_be_visible();expect(page.get_by_role('status').filter(has_text='سُحب وصول المتعاون')).to_be_visible();checks.append('confirmed removal removes member and reports revocation')
  assert all('Server Components render' in e for e in errors),errors
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/content-workspace-ui.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'scope':'Built UI with mock API; real HTTP and DB permissions tested separately','expectedRenderErrors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False))
