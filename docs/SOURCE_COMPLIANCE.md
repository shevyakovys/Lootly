# Source compliance

## Purpose

Lootly treats authorization to automate a marketplace as an explicit adapter requirement.
A source adapter must fail closed unless automated collection is supported by a documented
permission, public API/partner contract, licensed data provider, or another reviewed basis.

## Adapter gate

Every `MarketplaceAdapter` must expose `SourceAccessPolicy`:

- `automated_collection_allowed`;
- `evidence`;
- `reviewed_at`.

`AdapterRegistry.register()` refuses adapters whose policy does not authorize automated
collection.

This is intentionally independent from technical feasibility. A source being publicly
viewable does not by itself enable automated collection in Lootly.

## Avito review — 2026-09-18

Direct automated collection from Avito public search pages is not enabled.

Review findings:

- current Avito terms, as quoted in recent legal/technical materials, restrict technical
  means used to collect or process Avito content without a separate agreement;
- the current robots.txt representation for the general user-agent disallows `/api/`,
  `/q/*`, and multiple search/query parameters;
- Avito actively uses anti-automation controls, so CAPTCHA/proxy/fingerprint bypass would
  also conflict with Lootly project rules.

Therefore an Avito adapter may be enabled only after one of these changes:

1. Avito provides an official search/data API suitable for Lootly;
2. Lootly obtains explicit permission or a partner agreement;
3. Lootly uses a licensed data provider whose contract permits the required processing.

Do not implement CAPTCHA solving, proxy rotation, stealth-browser fingerprint evasion,
or similar circumvention as a substitute for authorization.
