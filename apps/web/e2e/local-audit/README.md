# Local browser audit fixtures

These Python Playwright tests use a built Next server on **127.0.0.1:3003** and an isolated mock API on **127.0.0.1:4000**. They do not prove live provider or end-to-end backend integration. Run from the repository root after installing project dependencies, Python Playwright and its Chromium browser. Set `WATHBA_TEST_CHROMIUM` only to use a different installed Chromium executable.

Build the web app with `NEXT_PUBLIC_API_URL=http://127.0.0.1:4000` and `WATHBA_BUILD_MODE=server`. Then run:

```text
python apps/web/e2e/local-audit/run-payment-ui.py test-role-administration-ui.py test-content-workspace-ui.py test-read-states-ui.py test-ops-navigation-ui.py test-authorization-release-ui.py test-authorization-ui.py test-grace-ui.py test-refund-verification-ui.py test-uncounted-void-ui.py test-held-payment-ui.py test-pending-return-ui.py
```

The latest run of these eleven suites passed 135 checks. Other scripts retain earlier phase scenarios and are not included in that latest count. The runner refuses an occupied web port, starts only its own loopback server, and shuts it down afterward; each suite owns its mock API. Do not run in parallel, do not build the web app while a suite is running, and do not point these fixtures at production. Output goes to the ignored `.cache/audit/` directory. The mock session strings are fixtures, never real credentials.

Backend database suites are separately gated by `WATHBA_CONSENT_DB_TESTS=1` and validate that the database is the isolated `wathba_audit` database on `127.0.0.1:55432`. They create local test records, not real payments. The current backend checkpoint passed 1346 tests in 99 suites. See `docs/platform-review-2026-10-13.md` for phase acceptance criteria and remaining work.
