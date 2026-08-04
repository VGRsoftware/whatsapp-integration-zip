# O que mudou — compatibilidade com Odoo 19.4 SaaS (saas~19.4)

Relatório das alterações feitas no módulo `custom_odoo_whatsapp` para que o ZIP seja
importável e funcione em **Odoo 19.4 SaaS Enterprise**. Branch `19.4`.

Referência de código: tudo abaixo foi conferido contra `odoo/odoo@saas-19.4`.

---

## Resumo

| # | Problema | Sintoma | Arquivo |
|---|---|---|---|
| 1 | `version` do manifesto fixava a série `19.0` | `AssertionError: Module not installable` | `__manifest__.py` |
| 2 | `ir.model.access` foi removido do Odoo 19.4 | `KeyError: 'ir.model.access'` | `security/security.xml` |
| 3 | Front-end usava a API OWL 2 do 19.0 | Bundle `web.assets_backend` quebrado ao abrir o formulário | `static/src/js/form_patch.js`, `static/src/xml/view.xml` |
| 4 | ZIP carregava a pasta morta `.git copy/` | 142 arquivos no pacote em vez de 16 | processo de empacotamento |

Os problemas 1 e 2 impediam a importação. O problema 3 só apareceria depois de instalar,
ao abrir um lead ou um pedido de venda.

---

## 1. `version` do manifesto — a causa do "Module not installable"

**Antes**

```python
"version": "19.0.1.1.0",
```

**Depois**

```python
"version": "1.2.1",
```

### Por quê

No 19.4, `odoo.release.major_version` é a string literal **`saas~19.4`** — não `19.4`.
A função `check_version()` em `odoo/modules/module.py` só aceita quatro formatos:
`x.y`, `x.y.z`, `<série>.x.y` ou `<série>.x.y.z`.

`19.0.1.1.0` tem 5 partes e não começa com `saas~19.4`, então reprova. Em seguida
`_load_manifest()` executa:

```python
_logger.warning("The module %s has an incompatible version, setting installable=False", module)
manifest['installable'] = False
```

E o importador de ZIP bate no assert (`addons/base_import_module/models/ir_module.py:154`):

```
AssertionError: Module not installable
```

Ou seja: a mensagem "não instalável" **não** vinha de nenhuma chave `installable` do
manifesto — vinha do próprio Odoo rebaixando o módulo por causa da versão.

Com 3 partes, `adapt_version()` prefixa a série corrente sozinho:

- em `saas~19.4` → `saas~19.4.1.2.1`
- em `19.0` → `19.0.1.2.1`

**Regra a manter:** nunca voltar a fixar a série no `version`. Só semver de 3 partes.

---

## 2. `ir.model.access` deixou de existir — virou `ir.access`

O 19.4 fundiu **`ir.model.access`** (permissões CRUD) e **`ir.rule`** (regras de registro)
em um único model **`ir.access`** (`odoo/addons/base/models/ir_access.py`). Referenciar o
model antigo em um arquivo de dados aborta a importação com `KeyError: 'ir.model.access'`.

**Antes**

```xml
<record id="ir_model_access_zap_messages" model="ir.model.access">
  <field name="group_id" ref="sales_team.group_sale_salesman"/>
  <field name="model_id" ref="custom_odoo_whatsapp.model_custom_zap_messages"/>
  <field name="name">zap_message</field>
  <field name="perm_create" eval="True"/>
  <field name="perm_read" eval="True"/>
  <field name="perm_unlink" eval="True"/>
  <field name="perm_write" eval="True"/>
</record>
```

**Depois**

```xml
<record id="ir_access_zap_messages" model="ir.access">
  <field name="name">zap_message</field>
  <field name="model_id" ref="custom_odoo_whatsapp.model_custom_zap_messages"/>
  <field name="group_id" ref="sales_team.group_sale_salesman"/>
  <field name="operation">crud</field>
</record>
```

### Mapeamento dos campos

| 19.0 | 19.4 |
|---|---|
| `model="ir.model.access"` | `model="ir.access"` |
| `perm_create` / `perm_read` / `perm_write` / `perm_unlink` (4 booleanos) | `operation` — selection obrigatória, subconjunto de `crud` (`crud` = acesso total) |
| model separado `ir.rule` + `domain_force` | campo opcional `domain` no mesmo record |
| `security/ir.model.access.csv` | `security/ir.access.csv` |

`name`, `model_id`, `group_id` e `active` continuam iguais.

O `operation` aceita qualquer subconjunto ordenado de `crud` — `r` (só leitura),
`cr`, `ru`, `crud` etc. Aqui foi mantido o acesso total que o módulo já concedia ao
grupo `sales_team.group_sale_salesman`, sem nenhuma mudança de permissão efetiva.

### Sobre o xmlid

O xmlid mudou de `ir_model_access_zap_messages` para **`ir_access_zap_messages`**.
Isso é intencional: um mesmo xmlid não pode apontar para models diferentes entre séries.
Se o xmlid antigo fosse reaproveitado, uma base 19.0 migrada para 19.4 teria o registro
apontando para um model que não existe mais.

---

## 3. Front-end: 19.4 migrou para OWL 3

O 19.4 roda OWL 3 através de uma camada de compatibilidade (`addons/web/static/src/owl2/`).
Cinco coisas mudaram e todas afetavam este módulo:

| Item | 19.0 | 19.4 |
|---|---|---|
| Módulo do componente Chatter | `@mail/chatter/web_portal/chatter` | **`@mail/chatter/web_portal_project/chatter`** (diretório renomeado) |
| Origem do `useRef` | `@odoo/owl` | **`@web/owl2/utils`** |
| Ref por nome no template | `t-ref="x"` | **`t-custom-ref="x"`** (`t-ref` agora recebe um signal ref) |
| Expressões QWeb | `props.x`, `state.x` | exigem prefixo **`this.`** |
| Prop `record` do chatter | `props.record` | **`this.webChatterProps.record`** (adicionada por `mail/chatter/web/chatter_patch.js`) |

O import de um módulo inexistente é fatal: derruba o bundle `web.assets_backend` inteiro,
não só o toggle.

### `static/src/js/form_patch.js`

```js
// antes
import { Chatter } from "@mail/chatter/web_portal/chatter";
import { useRef } from "@odoo/owl";

// depois
import { Chatter } from "@mail/chatter/web_portal_project/chatter";
import { useRef } from "@web/owl2/utils";
```

### `static/src/xml/view.xml`

- `<t t-inherit="mail.Chatter" t-inherit-mode="extension">` sem `t-name` (idioma usado
  pelos próprios addons do 19.4).
- `t-ref` → `t-custom-ref` nos elementos injetados.
- `props.record.data.x_iframe` → `this.webChatterProps.record.data.x_iframe`.
- Guarda de modelo agora com `this.` e proteção contra `record` ausente:
  `this.webChatterProps.record and (… === 'crm.lead' or … === 'sale.order')`.

### Mudança estrutural: parou de sequestrar refs do core

A versão 19.0 aplicava um xpath `position="attributes"` colocando `t-ref="chatterTop"` e
`t-ref="chatterContent"` nas divs nativas do chatter. No 19.4 isso **quebra o chatter**:
a div `o-mail-Chatter-top` já traz `t-custom-ref="top"`, usado pelo core, e sobrescrever
esse ref o anula.

Solução: nenhum ref é adicionado às divs do core. O `zapToggle()` sobe a partir do painel
injetado e acha as irmãs por seletor:

```js
const root = zap.parentElement;                                    // .o-mail-Chatter
const chatterTop = root.querySelector(":scope > .o-mail-Chatter-top");
const chatterContent = root.querySelector(":scope > .o-mail-Chatter-content");
```

O comportamento visível é idêntico ao do 19.0 — troca de `btn-primary`/`btn-secondary`
e adição/remoção da classe `hidden`. Continua sem estado reativo, sem store e sem RPC.

---

## 4. Empacotamento: `.git copy/` fora do ZIP

`custom_odoo_whatsapp/.git copy/` é um diretório git perdido que foi commitado no repo.
Ele estava indo para dentro do ZIP: **142 entradas** em vez de 16. Não era a causa da falha
de importação, mas é peso morto enviado ao servidor.

O diretório continua no repositório (não foi removido), apenas é excluído no empacotamento:

```powershell
# a partir da raiz do repo
$src = "custom_odoo_whatsapp"; $stage = "$env:TEMP\pkg\custom_odoo_whatsapp"
Remove-Item -Recurse -Force "$env:TEMP\pkg" -ErrorAction SilentlyContinue
robocopy $src $stage /E /XD ".git copy" | Out-Null
Compress-Archive -Path $stage -DestinationPath ".\custom_odoo_whatsapp.zip" -Force
```

O ZIP correto tem **16 entradas** e cerca de **540 KB** (as versões antigas, de ~52 KB,
nem continham `static/description/`). Vale conferir o tamanho antes de subir — durante a
depuração, um ZIP antigo do `Downloads/` foi importado por engano e reproduziu um erro já
corrigido.

---

## O que **não** mudou

- Continua **sem código Python**. `__init__.py` segue vazio.
- Models e campos continuam como records `state="manual"` (`x_` obrigatório), viáveis em SaaS.
- A lógica de compute do `x_iframe` e o formato da URL do app externo estão intactos,
  nas duas cópias (`crm.lead` e `sale.order`).
- A ordem de carga em `data` no manifesto continua a mesma e continua obrigatória.
- `x_whatsapp_messages` e seus campos, inclusive `x_zap_number` como char.
- As permissões efetivas: CRUD completo para `sales_team.group_sale_salesman`, e nada além.
- `static/description/index.html` e as restrições do sanitizador da Apps Store.

## Verificações feitas contra `odoo/odoo@saas-19.4`

Ainda existem e mantêm o mesmo formato: `ir.model`, `ir.model.fields`
(`state`/`ttype`/`store`/`compute`/`depends`), `ir.model.fields.selection`
(`field_id`/`value`/`name`/`sequence`), `ir.ui.view`, o template `mail.Chatter`, as classes
`o-mail-Chatter-top` e `o-mail-Chatter-content`, os xmlids `crm.crm_lead_view_form`,
`sale.view_order_form`, `crm.model_crm_lead`, `sale.model_sale_order`,
`sales_team.group_sale_salesman`, e o campo `crm.lead.phone`.

Os únicos models usados pelos arquivos de dados são `ir.model*`, `ir.ui.view` e `ir.access` —
nenhum outro foi removido no 19.4.

## Compatibilidade entre séries

Este branch (`19.4`) é **exclusivo do 19.4**: a sintaxe `this.webChatterProps` e o model
`ir.access` não existem no 19.0. O branch `19.0` segue intacto para aquela série, mantendo a
convenção do repositório de um branch por versão do Odoo.

A única alteração que serve às duas séries é a do `version` do manifesto — semver de 3 partes
funciona em qualquer uma.
