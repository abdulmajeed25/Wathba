import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
checks=[];errors=[]
class Api(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  path=self.path.split('?')[0];code=200
  if path=='/v1/platform/status':data={'maintenance':False}
  elif path=='/v1/users/me':data={'id':'local-admin','roles':['ADMIN'],'name':'اختبار'}
  elif path=='/v1/ops/auth/session':data={'roleKeys':['OWNER'],'permissions':['*'],'fourEyes':True,'moneyAdmins':2}
  elif path=='/v1/ops/dashboard':data={'workQueue':{'projectsUnderReview':3,'payoutsPending':2,'payoutsFailed':1},'vitals':{}}
  elif path=='/v1/ops/projects/stats':data={'statusCounts':{},'total':0}
  elif path in ['/v1/ops/alerts','/v1/ops/money/pledges','/v1/ops/projects','/v1/ops/operations']:data={'items':[],'nextCursor':None}
  else:code=404;data={}
  self.send_response(code);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_POST(self):self.send_response(204);self.end_headers()
server=ThreadingHTTPServer(('127.0.0.1',4000),Api);Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context=browser.new_context(viewport={'width':390,'height':844})
  context.add_cookies([{'name':n,'value':'local-fixture-only','url':'http://127.0.0.1:3003'} for n in ['wathba_session','wathba_ops_session']])
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:3003/ops/money?tab=refunds');page.wait_for_load_state('networkidle')
  header=page.locator('#ops-root > header');menu=page.get_by_role('button',name='أقسام مركز العمليات المال',exact=True);nav=page.get_by_role('navigation',name='أقسام مركز العمليات')
  expect(menu).to_have_attribute('aria-expanded','false');expect(nav).not_to_be_visible();checks.append('mobile opens with current section named and navigation collapsed')
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':1000})
   for density in ['مريح','مضغوط']:
    header.get_by_role('button',name=density,exact=True).click()
    for theme in ['داكن','فاتح']:
     header.get_by_role('button',name=theme,exact=True).click()
     for control in header.get_by_role('button').all():
      box=control.bounding_box();assert box and box['x']>=0 and box['x']+box['width']<=width+1 and box['height']>=44,(width,density,theme,control.inner_text(),box)
     assert header.evaluate('(el)=>el.scrollWidth<=el.clientWidth+1'),(width,density,theme)
   if width>=768:expect(nav).to_be_visible();expect(menu).not_to_be_visible()
   checks.append(f'header touch targets fit {width}px in both themes and densities')
  page.set_viewport_size({'width':390,'height':844});menu.click();expect(menu).to_have_attribute('aria-expanded','true');expect(nav).to_be_visible()
  for label in ['المال','المشاريع','المستخدمون','الثقة والأمان','المورّدون','الإعدادات']:expect(nav.get_by_role('link',name=label,exact=True)).to_be_visible()
  for link in nav.get_by_role('link').all():
   box=link.bounding_box();assert box['height']>=44 and box['x']>=0 and box['x']+box['width']<=390+1
  assert nav.get_by_role('link',name='المال',exact=True).get_attribute('aria-current')=='page';checks.append('expanded mobile navigation exposes all operational groups, current route and 44px links')
  nav.get_by_role('link',name='المشاريع',exact=True).focus();page.keyboard.press('Escape');expect(menu).to_be_focused();expect(nav).not_to_be_visible();checks.append('Escape collapses mobile navigation and restores its trigger focus')
  menu.click();nav.get_by_role('link',name='المشاريع',exact=True).click();expect(page.get_by_role('heading',level=1,name='المشاريع',exact=True)).to_be_visible()
  expect(page.get_by_role('button',name='أقسام مركز العمليات المشاريع',exact=True)).to_have_attribute('aria-expanded','false');checks.append('section navigation updates current label and closes the mobile menu')
  search=page.get_by_role('button',name='بحث سريع',exact=True);search.click();dialog=page.get_by_role('dialog',name='لوحة الأوامر');expect(dialog).to_be_visible()
  query=page.get_by_role('textbox',name='ابحث في الأقسام والعمليات');expect(query).to_be_focused();query.fill('§')
  expect(dialog.get_by_text('لا نتائج مطابقة',exact=True)).to_be_visible();checks.append('touch search opens focused field and displays no-result state')
  page.get_by_role('button',name='إغلاق البحث',exact=True).focus();page.keyboard.press('Escape');expect(dialog).not_to_be_visible();expect(search).to_be_focused();checks.append('Escape closes search from any focused control and returns focus')
  search.click();query.fill('المال');page.keyboard.press('Enter');expect(page).to_have_url('http://127.0.0.1:3003/ops/money');checks.append('Arabic quick search navigates using the keyboard')
  page.keyboard.press('Control+k');expect(dialog).to_be_visible();query.fill('§')
  for _ in range(5):page.keyboard.press('Tab');assert dialog.evaluate('(el)=>el.contains(document.activeElement)')
  page.get_by_role('button',name='إغلاق البحث',exact=True).click();expect(dialog).not_to_be_visible();checks.append('keyboard shortcut and focus loop remain usable with visible close control')
  header.get_by_role('button',name='داكن',exact=True).click();header.get_by_role('button',name='مريح',exact=True).click();page.reload();page.wait_for_load_state('networkidle')
  expect(page.locator('#ops-root')).to_have_attribute('data-theme','dark');expect(page.locator('#ops-root')).to_have_attribute('data-density','comfortable');checks.append('theme and density persist across reload')
  page.screenshot(path='.cache/audit/ops-navigation-mobile-dark.png',full_page=False)
  header.get_by_role('button',name='فاتح',exact=True).click();page.get_by_role('button',name='أقسام مركز العمليات المال',exact=True).click();page.screenshot(path='.cache/audit/ops-navigation-mobile-light.png',full_page=False)
  page.set_viewport_size({'width':1440,'height':1000});page.screenshot(path='.cache/audit/ops-navigation-desktop.png',full_page=False)
  assert not errors,errors
  browser.close()
finally:
 server.shutdown();server.server_close()
 Path('.cache/audit/ops-navigation-ui.json').write_text(json.dumps({'scope':'Built Next UI, isolated mock API; navigation only, not full accessibility certification','passed':len(checks),'checks':checks,'pageErrors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False))
