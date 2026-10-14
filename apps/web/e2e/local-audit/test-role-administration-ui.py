import os, json
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright, expect

state = {'role': 'OWNER', 'catalogueFail': False, 'usersFail': False, 'usersRefused': False}
uid = '11111111-1111-4111-8111-111111111111'
roles = [
 {'key': 'OWNER', 'nameAr': 'المالك', 'permissions': ['*']},
 {'key': 'OPS_MANAGER', 'nameAr': 'مدير العمليات', 'permissions': ['users.lifecycle', 'users.roles.assign']},
 {'key': 'CUSTOM_REVIEW', 'nameAr': 'مراجع مخصص', 'permissions': ['projects.review']},
]
checks = []; errors = []; writes = []
class Api(BaseHTTPRequestHandler):
 def log_message(self, *args): pass
 def send(self, data, code=200):
  self.send_response(code); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(json.dumps(data).encode())
 def do_GET(self):
  path = self.path.split('?')[0]
  if path == '/v1/platform/status': self.send({'maintenance': False})
  elif path == '/v1/users/me': self.send({'id': 'local-admin', 'roles': ['ADMIN'], 'name': 'اختبار'})
  elif path == '/v1/ops/auth/session': self.send({'roleKeys': [state['role']], 'permissions': ['*'] if state['role'] == 'OWNER' else ['users.lifecycle', 'users.roles.assign'], 'fourEyes': True, 'moneyAdmins': 2})
  elif path == '/v1/ops/auth/roles': self.send({'roles': roles, 'permissions': ['projects.review', 'users.lifecycle', 'users.roles.assign']} if not state['catalogueFail'] else {}, 503 if state['catalogueFail'] else 200)
  elif path == '/v1/ops/users': self.send({'items': [{'id': uid, 'name': 'عضو اختبار', 'email': 'a***@local.test', 'handle': None, 'roles': ['BACKER'], 'opsRoleKeys': ['CUSTOM_REVIEW']}]} if not (state['usersFail'] or state['usersRefused']) else {}, 403 if state['usersRefused'] else 503 if state['usersFail'] else 200)
  elif path in ['/v1/ops/alerts', '/v1/ops/operations']: self.send({'items': []})
  else: self.send({}, 404)
 def do_POST(self):
  writes.append(self.path); self.send({}, 403)

server = ThreadingHTTPServer(('127.0.0.1', 4000), Api)
Thread(target=server.serve_forever, daemon=True).start()
try:
 with sync_playwright() as p:
  browser = p.chromium.launch(headless=True, executable_path=os.environ.get('WATHBA_TEST_CHROMIUM'))
  context = browser.new_context(viewport={'width': 390, 'height': 844})
  context.add_cookies([{'name': name, 'value': 'local-fixture-only', 'url': 'http://127.0.0.1:3003'} for name in ['wathba_session', 'wathba_ops_session']])
  page = context.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
  def go():
   page.goto('http://127.0.0.1:3003/ops/team', wait_until='domcontentloaded')
   expect(page.get_by_role('heading', name='فريق العمل والأدوار', exact=True)).to_be_visible()
  go()
  expect(page.get_by_role('columnheader', name='CUSTOM_REVIEW', exact=True)).to_be_visible()
  expect(page.get_by_text('projects.review', exact=True)).to_be_visible()
  checks.append('matrix renders persisted custom roles and current permissions')
  grant = page.get_by_role('button', name='منح دور العمليات', exact=True)
  revoke = page.get_by_role('button', name='سحب دور العمليات', exact=True)
  expect(grant).to_be_disabled(); expect(revoke).to_be_disabled()
  checks.append('owner cannot start role mutation without a valid target')
  page.get_by_role('button', name='اختيار', exact=True).click()
  page.get_by_label('دور العمليات المطلوب', exact=True).select_option('CUSTOM_REVIEW')
  expect(grant).to_be_enabled(); expect(revoke).to_be_enabled()
  expect(page.get_by_label('دور العمليات المطلوب', exact=True)).to_have_value('CUSTOM_REVIEW')
  checks.append('owner can select an actual custom role and target from masked directory')
  for width in [390, 1440]:
   page.set_viewport_size({'width': width, 'height': 900})
   assert page.locator('#ops-root').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1')
  page.set_viewport_size({'width': 390, 'height': 844})
  page.screenshot(path='.cache/audit/role-administration-mobile.png', full_page=True, animations='disabled')
  checks.append('role matrix scrolls within page at mobile and desktop widths')
  state['role'] = 'OPS_MANAGER'; go()
  expect(grant).not_to_be_visible(); expect(revoke).not_to_be_visible()
  expect(page.get_by_label('دور العمليات المطلوب', exact=True)).not_to_be_visible()
  page.get_by_role('button', name='اختيار', exact=True).click()
  expect(page.get_by_role('button', name='منح دور المنتج', exact=True)).to_be_enabled()
  checks.append('manager sees owner-only explanation while retaining authorized product-role controls')
  state['role'] = 'OWNER'; state['catalogueFail'] = True; go()
  expect(page.get_by_role('alert').filter(has_text='تعذر تحميل الأدوار الفعلية')).to_be_visible()
  expect(page.get_by_role('columnheader', name='CUSTOM_REVIEW', exact=True)).not_to_be_visible()
  expect(grant).not_to_be_visible()
  checks.append('catalogue outage shows no invented matrix or administrative mutation control')
  state['catalogueFail'] = False; page.get_by_role('button', name='إعادة تحميل الأدوار', exact=True).click()
  expect(page.get_by_label('دور العمليات المطلوب', exact=True)).to_be_visible()
  checks.append('catalogue retry restores the live role choices')
  state['usersFail'] = True; go()
  expect(page.get_by_role('alert').filter(has_text='تعذرت قراءة المستخدمين')).to_be_visible()
  expect(page.get_by_text('لا مستخدمين', exact=True)).not_to_be_visible(); expect(grant).not_to_be_visible()
  checks.append('directory outage is distinct from verified empty data and blocks selection')
  state['usersFail'] = False; page.get_by_role('button', name='إعادة تحميل الفريق', exact=True).click()
  expect(page.get_by_text('عضو اختبار', exact=True)).to_be_visible()
  checks.append('directory retry restores actual fixture membership')
  state['usersRefused'] = True; go()
  expect(page.get_by_text('تفتقد صلاحية users.lifecycle لعرض دليل المستخدمين.', exact=True)).to_be_visible()
  expect(page.get_by_role('button', name='اختيار', exact=True)).not_to_be_visible()
  checks.append('directory access refusal has explicit permission state')
  assert not errors, errors
  assert not any('/execute' in path or '/dry-run' in path for path in writes), writes
  browser.close()
finally:
 server.shutdown(); server.server_close()
 Path('.cache/audit/role-administration-ui.json').write_text(json.dumps({'passed': len(checks), 'checks': checks, 'pageErrors': errors, 'scope': 'Built UI and isolated mock API; actual mutation enforcement is covered by separate database tests'}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'passed': len(checks), 'checks': checks}, ensure_ascii=False))
