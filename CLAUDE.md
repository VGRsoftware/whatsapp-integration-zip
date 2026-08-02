# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`custom_odoo_whatsapp` — an Odoo 19 addon (license OPL-1, author VGR) that embeds a WhatsApp conversation panel inside the Odoo chatter on `crm.lead` and `sale.order` forms. Published on the Odoo Apps Store.

**There is no Python code.** `__init__.py` is intentionally empty. The whole module is XML data records plus an OWL frontend patch. Do not add Python model classes unless deliberately changing that design — the module targets Odoo SaaS/Online, where only data-defined (`state="manual"`) models and fields are viable.

## Repo layout and branches

- Branch `19.0` (current, default working branch): module lives in the `custom_odoo_whatsapp/` subfolder.
- Branch `main`: older layout, module files at repo root, no `static/description/`. Branches are per-Odoo-version, not feature branches; they have unrelated paths so `git diff main 19.0` is not meaningful.
- `custom_odoo_whatsapp/.git copy/` is a stray nested git directory that got committed. It is not a submodule and not used. Leave it alone; never edit files under it.

## Commands

No build, lint, or test tooling exists in this repo — no `package.json`, no test suite, no CI. Verification is manual: install the module in an Odoo 19 instance and exercise a CRM lead / sale order form.

Standard Odoo commands for iterating (run from an Odoo 19 checkout with this repo on the addons path):

```bash
# Upgrade the module after ANY XML change (fields/models/views are data records)
odoo-bin -d <db> -u custom_odoo_whatsapp

# Reload JS/XML/CSS assets without a full restart while editing the frontend
odoo-bin -d <db> -u custom_odoo_whatsapp --dev=xml,assets
```

Packaging for the Apps Store: zip the `custom_odoo_whatsapp/` folder itself (the folder name must be the module technical name).

## Architecture

### Server side: everything is `state="manual"` data records

The module declares models and fields as `ir.model` / `ir.model.fields` records rather than Python classes. Consequences worth remembering:

- Every field name must start with `x_`, every model name with `x_`.
- Compute logic lives as **Python source inside an XML `<field name="compute">` CDATA block** (`models/models.xml`). It runs in Odoo's restricted server-action eval context: it may use `self`, `record.env`, and must assign via `record['x_field']`. No imports, no helper functions.
- Editing this XML has no effect until the module is upgraded (`-u`).

**Load order in `__manifest__.py` `data` is significant** and must be preserved:
`models/models.xml` → `models/whatsapp_models.xml` → `models/whatsapp_messages_fields.xml` → `views/views.xml` → `security/security.xml`. The field records reference the model record via `ref="model_custom_zap_messages"`, and `security.xml` references it too.

### The `x_iframe` bridge

`models/models.xml` defines `x_iframe` twice — once on `crm.lead`, once on `sale.order` — as a non-stored (`store=false`) computed text field. Its compute builds a URL to an **external single-page app** and stuffs it with context:

```
https://whatsapp-odoo.pages.dev/?partner_id=<id>&contact_phone=<digits>&odoo_url=<web.base.url>&odoo_user_id=<uid>
```

The phone is normalized by stripping spaces, `-`, and `+`. The two copies of the compute differ only in where the phone comes from (`record.phone` on the lead, `record.partner_id.phone` on the order) and in their `depends`. **Any change to the URL shape or normalization must be applied to both records** — they are duplicated on purpose, since manual fields cannot share a mixin.

`views/views.xml` exists solely so the field reaches the browser: it xpaths `<field name="x_iframe" invisible="1"/>` into both form views. Without that, `props.record.data.x_iframe` is undefined in OWL and the iframe renders blank.

### Frontend: chatter toggle

Two assets in `web.assets_backend` work as a pair:

- `static/src/xml/view.xml` — `t-inherit` extension of the `mail.Chatter` QWeb template. Adds `t-ref` attributes to the existing `o-mail-Chatter-top` and `o-mail-Chatter-content` divs, then injects a Chatter/WhatsApp button pair and a hidden `<div t-ref="zap">` containing an `<iframe t-att-src="props.record.data.x_iframe"/>`. The whole injection is wrapped in `t-if="props.record.resModel == 'crm.lead' || props.record.resModel == 'sale.order'"` — this guard is what keeps the toggle off every other model's chatter.
- `static/src/js/form_patch.js` — `patch(Chatter.prototype, ...)` grabs those five refs in `setup()` and implements `zapToggle(view)`, which does nothing but swap `btn-primary`/`btn-secondary` and add/remove the `hidden` class. State is pure DOM class manipulation; there is no reactive state, no store, no RPC.

The refs in the JS (`zap`, `chatterTop`, `chatterContent`, `chatter-btn`, `zap-btn`) must stay in sync with the `t-ref` names in the XML. `.hidden { display: none !important }` is defined in `static/src/css/toggle.css` — it is a local utility class, not a Bootstrap/Odoo one, so removing that CSS silently breaks the toggle.

Because the template extends core `mail.Chatter`, its xpath expressions target Odoo's own markup (`o-mail-Chatter-top`, `o-mail-Chatter-content`). An Odoo version bump is the likely cause if the toggle disappears — check those class names first.

### `x_whatsapp_messages`

A manual model (`models/whatsapp_models.xml`) with fields defined in `models/whatsapp_messages_fields.xml`: `x_name`, `x_date`, `x_direction` (selection `in`/`out`), `x_jid`, `x_message`, `x_status`, `x_zap_number`. Nothing in this module reads or writes it — it is the landing table the external service/HUB pushes into. `x_zap_number` is deliberately a **char, not a many2one**: it stores the HUB seat's `x_session_id` and the HUB is a different database. Do not "fix" it into a relation.

`security/security.xml` grants full CRUD on it to `sales_team.group_sale_salesman`, and nothing else.

## `static/description/index.html` — Apps Store sanitization

This is the Apps Store listing page and it is the largest file in the repo. It carries a Portuguese header comment documenting constraints confirmed against the published page; read it before editing. Summary of what the store's server-side sanitizer does:

- The `<style>` tag is stripped entirely — no CSS classes, no `:hover`, no media queries survive. The `<style>` block present in the file is dead on the store and kept only for raw-HTML previews.
- Inline `style` attributes pass a longhand-property whitelist. Survives: `border*`, `border-spacing`, `color`, `display`, `font-*`, `padding-*`, `margin-*`, `width`, `height`, `max-width`, `min-width`, `line-height`, `text-align`, `text-decoration`, `text-transform`, `vertical-align`, `letter-spacing`, `background-color`. Removed: `background` (shorthand), `flex`, `flex-wrap`, `gap`, `justify-content`, `align-items`, `box-sizing`, `box-shadow`, `transition`, `transform`, `position`.
- Only `apps.odoo.com`, `www.youtube.com`, and `mailto:` links stay as `<a>`. Any other domain becomes `<span href="...">` — text remains, link dies.

Hence the layout is `<table>` + `border-spacing` instead of flexbox, `background-color` instead of `background`, and all styling inline. **Keep that pattern when editing.** Same rule applies to `banner.png` / `banner_index.png` / `icon.png` referenced from the manifest.

## Conventions

- User-facing copy and code comments are pt-BR; the manifest description is English.
- Bump `"version"` in `__manifest__.py` (format `19.0.1.0.0` — Odoo series then module semver) when publishing a store update.
