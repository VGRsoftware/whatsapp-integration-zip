# Teste da API de envio — `POST /send`

Roteiro para validar o endpoint de recebimento (`API recebimento.md`) e decidir
**por qual caminho o zip do Odoo vai disparar**.

Base: `https://zap-odoo-production-1063.up.railway.app`
Token: campo `x_api_token` do registro em **Whatsapp Números** (base HUB).

Os testes são encadeados. Rode na ordem: A e B validam a API sozinha; C decide
a arquitetura; D ou E é o que entra no zip.

| Teste | Onde roda | Prova o quê |
|---|---|---|
| A | terminal (curl) | token vale, API aceita o payload |
| B | terminal (python) | o payload que o Odoo montaria é aceito |
| C | Odoo, ação de servidor | `requests` existe ou não no safe_eval |
| D | Odoo, ação de servidor | envio real, header `Authorization` (só se C passar) |
| E | Odoo, ação webhook | envio possível em SaaS (exige rota no backend) |

> **Atenção:** A, B, D e E **enviam mensagem de WhatsApp de verdade** para os
> números que estiverem em `content[]`. Use um número seu nos primeiros testes.

---

## Teste A — curl direto

Menor teste possível. Se falhar aqui, nada mais importa.

```bash
TOKEN="COLE_SEU_TOKEN_AQUI"
BASE="https://zap-odoo-production-1063.up.railway.app"

curl -i -X POST "$BASE/send" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Teste ZapOdoo. Olá {{name}}, seu ticket é {{ticket}}.",
    "content": [
      { "number": "+5541999998888", "params": { "name": "Victor", "ticket": 1 } }
    ]
  }'
```

Esperado — `202 Accepted`:

```json
{ "batch_id": "b3-mkq2x1a", "accepted": 1, "status_url": "/send/b3-mkq2x1a" }
```

Acompanhar o lote (o envio é assíncrono, 3–6 s entre mensagens):

```bash
curl -s "$BASE/send/b3-mkq2x1a" -H "Authorization: Bearer $TOKEN"
```

### Leitura dos códigos

| Código | Significado | O que fazer |
|---|---|---|
| `202` | aceito, enviando em segundo plano | seguir para o Teste B |
| `400` | payload inválido | `message` vazio, `content` não-array/vazio/>1000, item sem `number` |
| `401` | token ausente ou inválido | conferir o `x_api_token` no HUB |
| `409` | número existe mas não está conectado | reconectar o assento no HUB |
| `429` | mais de 6 requisições no último minuto | esperar 60 s |

---

## Teste B — payload montado igual ao do Odoo

Este script é a **réplica fiel** do que a ação do Odoo monta: um único
`message` com marcadores `{{campo}}` e um `params` por destinatário. Serve para
validar o formato antes de mexer no módulo.

Salve como `teste_send.py` e rode com `python teste_send.py`.

```python
import json
import os
import time
import urllib.error
import urllib.request

BASE = "https://zap-odoo-production-1063.up.railway.app"
TOKEN = os.environ.get("ZAP_TOKEN") or "COLE_SEU_TOKEN_AQUI"

# Corpo do template como esta gravado em x_whatsapp_template.x_body,
# ja convertido de {campo} (Odoo) para {{campo}} (API).
MESSAGE = "Ola {{name}}, esse e um teste do envio em massa. Ticket {{ticket}}."

# Um item por destinatario. `params` = valores dos campos de res.partner.
CONTENT = [
    {"number": "+5541999998888", "params": {"name": "Victor", "ticket": 1}},
    # {"number": "+5541988887777", "params": {"name": "Gabriel", "ticket": 2}},
]


def chamar(path, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Authorization": "Bearer " + TOKEN}
    if data:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as erro:
        return erro.code, erro.read().decode("utf-8")


payload = {"message": MESSAGE, "content": CONTENT}
print("REQUEST:", json.dumps(payload, ensure_ascii=False, indent=2))

status, body = chamar("/send", payload)
print("STATUS:", status)
print("RESPONSE:", body)

if status != 202:
    raise SystemExit("Falhou. Confira a tabela de codigos do Teste A.")

batch_id = body["batch_id"]
prog = None
for _ in range(10):
    time.sleep(6)
    _, prog = chamar("/send/" + batch_id)
    print(
        "total=%s pending=%s sent=%s failed=%s"
        % (prog["total"], prog["pending"], prog["sent"], prog["failed"])
    )
    if prog["pending"] == 0 and prog["queued"] == 0:
        break

print("ITENS:", json.dumps(prog["items"], ensure_ascii=False, indent=2))
```

Sem dependência externa — `urllib` é stdlib. Se preferir `requests`, troque
`chamar()` por `requests.post(BASE + path, json=payload, headers=headers)`.

---

## Teste C — sonda: `requests` existe no safe_eval do Odoo?

**Este é o teste que decide a arquitetura.** Cole em
*Configurações → Técnico → Ações do Servidor → Novo*, modelo
`WhatsApp Campaing` (`x_whatsapp_campaing`), tipo **Executar código Python**,
e rode.

```python
# SONDA - descobre se a base permite HTTP dentro de uma acao de servidor.
# Nao envia mensagem: manda content vazio, a API deve responder 400.
try:
    resposta = requests.post(
        "https://zap-odoo-production-1063.up.railway.app/send",
        json={"message": "sonda", "content": []},
        headers={"Authorization": "Bearer COLE_SEU_TOKEN_AQUI"},
        timeout=10,
    )
    raise UserError("SONDA OK: requests DISPONIVEL. HTTP %s -> %s" % (resposta.status_code, resposta.text))
except Exception as erro:
    raise UserError("SONDA: %s" % erro)
```

### Como ler o resultado

| Diálogo mostrado | Conclusão | Caminho |
|---|---|---|
| `SONDA OK: requests DISPONIVEL. HTTP 400 -> ...` | HTTP liberado | **Teste D** |
| `SONDA: name 'requests' is not defined` | safe_eval bloqueia | **Teste E** |
| Erro do Odoo antes de rodar: `forbidden opcode(s)` | bloqueio no bytecode | **Teste E** |

Referência do bloqueio, `odoo/odoo@saas-19.4`:

- `odoo/addons/base/models/ir_actions.py:125` e `:1112` — contexto do `state='code'`:
  `uid, user, time, datetime, dateutil, timezone, float_compare, b64encode,
  b64decode, BinaryBytes, Command, env, model, record, records, log, _logger,
  UserError`. Sem `requests`, sem `json`, sem `urllib`.
- `odoo/tools/safe_eval/evaluation.py:110` — `IMPORT_NAME`, `IMPORT_FROM` e
  `IMPORT_STAR` em `_BLACKLIST`, então `import requests` nem compila.
- `odoo/tools/safe_eval/evaluation.py:73` — `__import__` é um mock sem `return`.

---

## Teste D — ação de servidor completa (só se a sonda passar)

Envio real, respeitando o contrato do `API recebimento.md`: um `POST /send` por
campanha, `message` único com `{{campo}}` e um `params` por destinatário.

Ação de servidor no modelo `x_whatsapp_campaing`, tipo **Executar código Python**,
com *binding* em `list,form` para aparecer no menu **Ações** e no botão do formulário.

```python
# ---------------------------------------------------------------------------
# ENVIO EM MASSA - POST /send
#
# Template (x_body) usa {campo}, onde `campo` e o nome tecnico de um campo de
# res.partner. A API usa {{campo}} + params por destinatario, entao a conversao
# e: {campo} -> {{campo}} no `message`, e o valor de cada parceiro vai em params.
#
# Sem `json` no safe_eval: nao e preciso. requests.post(json=...) serializa.
# ---------------------------------------------------------------------------

BASE = "https://zap-odoo-production-1063.up.railway.app"
TOKEN = env["ir.config_parameter"].sudo().get_param("whatsapp_mass.api_token")

if not TOKEN:
    raise UserError("Parametro de sistema 'whatsapp_mass.api_token' nao definido.")

campanhas = records or model
if not campanhas:
    raise UserError("Nenhuma campanha selecionada.")

campos_partner = env["res.partner"].fields_get()


def html_para_texto(bruto):
    """Remove tags do campo html. <br> e </p> viram quebra de linha."""
    texto = str(bruto or "")
    for tag, troca in (("<br>", "\n"), ("<br/>", "\n"), ("<br />", "\n"), ("</p>", "\n")):
        texto = texto.replace(tag, troca)
    saida = ""
    dentro = False
    for char in texto:
        if char == "<":
            dentro = True
        elif char == ">":
            dentro = False
        elif not dentro:
            saida += char
    for entidade, troca in (("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'")):
        saida = saida.replace(entidade, troca)
    return saida.strip()


def converter_placeholders(texto):
    """Parser de {campo} sem regex (safe_eval nao expoe `re`).

    Devolve (message_api, nomes_de_campos):
      message_api  - mesmo texto com {campo} trocado por {{campo}}
      nomes_campos - lista dos campos validos de res.partner encontrados
    """
    partes = texto.split("{")
    saida = partes[0]
    nomes = []
    for parte in partes[1:]:
        if "}" not in parte:
            saida += "{" + parte
            continue
        chave, resto = parte.split("}", 1)
        nome = chave.strip()
        if nome not in campos_partner:
            log("[Envio em Massa] Placeholder '{%s}' ignorado: campo inexistente em res.partner." % nome, level="warning")
            saida += "{" + parte
            continue
        if nome not in nomes:
            nomes.append(nome)
        saida += "{{" + nome + "}}" + resto
    return saida, nomes


def valor_do_campo(parceiro, nome):
    valor = parceiro[nome]
    tipo = campos_partner[nome]["type"]
    if not valor:
        return ""
    if tipo == "many2one":
        return valor.display_name
    if tipo in ("many2many", "one2many"):
        return ", ".join(valor.mapped("display_name"))
    return str(valor)


def normalizar_numero(bruto):
    """So digitos. Prefixa 55 quando o DDI nao veio: a API aceita qualquer
    formatacao, mas nao adivinha o pais."""
    digitos = ""
    for char in str(bruto or ""):
        if char in "0123456789":
            digitos += char
    if digitos and not digitos.startswith("55"):
        digitos = "55" + digitos
    return digitos


for campanha in campanhas:
    if not campanha.x_template_id:
        raise UserError("Campanha '%s' sem template." % campanha.x_name)

    mensagem, nomes_campos = converter_placeholders(html_para_texto(campanha.x_template_id.x_body))
    if not mensagem:
        raise UserError("Campanha '%s': corpo do template vazio (a API rejeita com 400)." % campanha.x_name)

    conteudo = []
    for parceiro in campanha.x_partner_ids:
        numero = normalizar_numero(parceiro.phone)
        if not numero:
            log("[Envio em Massa] Parceiro '%s' (id %s) sem phone: fora do lote." % (parceiro.display_name, parceiro.id), level="warning")
            continue
        item = {"number": numero}
        if nomes_campos:
            item["params"] = {nome: valor_do_campo(parceiro, nome) for nome in nomes_campos}
        conteudo.append(item)

    if not conteudo:
        raise UserError("Campanha '%s': nenhum destinatario com telefone." % campanha.x_name)
    if len(conteudo) > 1000:
        raise UserError("Campanha '%s': %s destinatarios, o limite por requisicao e 1000." % (campanha.x_name, len(conteudo)))

    campanha.write({"x_status": "processing"})

    resposta = requests.post(
        BASE + "/send",
        json={"message": mensagem, "content": conteudo},
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"},
        timeout=30,
    )

    if resposta.status_code == 202:
        corpo = resposta.json()
        campanha.write({"x_status": "sent", "x_batch_id": corpo.get("batch_id") or ""})
        log("[Envio em Massa] Campanha '%s' (id %s): %s aceitos, batch_id %s." % (campanha.x_name, campanha.id, corpo.get("accepted"), corpo.get("batch_id")))
    else:
        campanha.write({"x_status": "error"})
        log("[Envio em Massa] Campanha '%s' (id %s): HTTP %s -> %s" % (campanha.x_name, campanha.id, resposta.status_code, resposta.text), level="error")
        raise UserError("Falha no envio (HTTP %s): %s" % (resposta.status_code, resposta.text))
```

### O que precisa existir para esse código rodar

| Item | Onde | Observação |
|---|---|---|
| `whatsapp_mass.api_token` | *Configurações → Técnico → Parâmetros do Sistema* | um token por número conectado |
| `x_batch_id` | campo char novo em `x_whatsapp_campaing` | guarda o retorno do `202` |
| `x_status` | já existe | `pending / processing / sent / error` |
| `x_partner_ids` | já existe | os parceiros precisam ter `phone` preenchido |

**Segurança:** o token é a credencial do número inteiro — quem o tiver envia
por aquele WhatsApp. Em `ir.config_parameter` ele é legível por qualquer usuário
com acesso a Parâmetros do Sistema (`base.group_system`). Não escreva o token no
corpo da ação de servidor nem em campo visível na campanha, e rotacione no HUB
se ele aparecer em log.

### Consultar o progresso depois

Ação separada, mesmo modelo, para atualizar o status a partir do `batch_id`:

```python
BASE = "https://zap-odoo-production-1063.up.railway.app"
TOKEN = env["ir.config_parameter"].sudo().get_param("whatsapp_mass.api_token")

for campanha in (records or model):
    if not campanha.x_batch_id:
        continue
    resposta = requests.get(
        BASE + "/send/" + campanha.x_batch_id,
        headers={"Authorization": "Bearer " + TOKEN},
        timeout=30,
    )
    corpo = resposta.json()
    log("[Envio em Massa] Lote %s: total=%s pending=%s sent=%s failed=%s" % (campanha.x_batch_id, corpo.get("total"), corpo.get("pending"), corpo.get("sent"), corpo.get("failed")))
    if corpo.get("pending") == 0 and corpo.get("queued") == 0:
        campanha.write({"x_status": "error" if corpo.get("failed") else "sent"})
```

---

## Teste E — fallback SaaS (`state='webhook'`)

Se a sonda do Teste C falhar, a **única** saída HTTP nativa do Odoo SaaS é a ação
de servidor tipo *Send Webhook Notification*. Ela não aceita header customizado —
`odoo/addons/base/models/ir_actions.py:1075`:

```python
response = requests.post(url, data=json_values, headers={'Content-Type': 'application/json'}, timeout=1)
```

E o corpo tem chaves fixas (`ir_actions.py:1049`):

```python
vals = {
    '_model': self.model_id.model,
    '_id': record.id,
    '_action': f'{self.name}(#{self.id})',
}
vals.update(record.read(self.webhook_field_ids.mapped('name'), load=None)[0])
```

Campos manuais são obrigados a começar com `x_`, então **não dá para emitir as
chaves `message` e `content`** nem o header `Authorization`. O backend precisa de
uma rota adaptadora.

### Desenho nesse cenário

**1.** Ação `code` monta o JSON do `API recebimento.md` **como string** e grava em
`x_payload` (campo text novo na campanha). Sem `json` no safe_eval, o encoder é
feito à mão:

```python
def json_str(valor):
    saida = '"'
    for char in str(valor):
        if char == '"':
            saida += '\\"'
        elif char == "\\":
            saida += "\\\\"
        elif char == "\n":
            saida += "\\n"
        elif char == "\r":
            saida += "\\r"
        elif char == "\t":
            saida += "\\t"
        elif ord(char) < 32:
            saida += "\\u%04x" % ord(char)
        else:
            saida += char
    return saida + '"'


itens = []
for item in conteudo:
    pares = ",".join([json_str(k) + ":" + json_str(v) for k, v in item.get("params", {}).items()])
    itens.append('{"number":' + json_str(item["number"]) + ',"params":{' + pares + "}}")

campanha.write({"x_payload": '{"message":' + json_str(mensagem) + ',"content":[' + ",".join(itens) + "]}"})
```

**2.** Ação `webhook` com `webhook_url` apontando para a rota nova (token no path)
e `webhook_field_ids` = `[x_payload]`. Corpo que chega no backend:

```json
{
  "_model": "x_whatsapp_campaing",
  "_id": 7,
  "_action": "Enviar campanha(#412)",
  "x_payload": "{\"message\":\"...\",\"content\":[...]}"
}
```

**3.** Rota adaptadora no backend (`zap-odoo`), ~15 linhas:

```js
// POST /send/odoo/:token — adaptador para o webhook nativo do Odoo SaaS,
// que não permite header Authorization nem corpo customizado.
app.post("/send/odoo/:token", express.json({ limit: "10mb" }), (req, res) => {
  const numero = autenticarPorToken(req.params.token);   // mesma auth do Bearer
  if (!numero) return res.status(401).json({ error: "token inválido" });

  let payload;
  try {
    payload = JSON.parse(req.body.x_payload || "");
  } catch {
    return res.status(400).json({ error: "x_payload não é JSON válido" });
  }
  return tratarSend(numero, payload, res);              // handler já existente do /send
});
```

### Limitações desse caminho

- **Token na URL.** Vai parar em log de acesso, proxy e histórico do navegador.
  Trate a rota como credencial exposta: use um token separado só para o webhook e
  rotacione se o log vazar.
- **`timeout=1` e *send and forget*** (`ir_actions.py:1073`): a resposta é
  descartada. O Odoo **não recebe o `batch_id`** — ele teria que voltar por outro
  caminho (o HUB escrevendo na base via Odoo external API).
- O POST só sai **depois do commit** (`self.env.cr.postcommit`, `ir_actions.py:1066`).
  Rollback na transação = nada enviado, e o aviso sai só em nível `warning`.

---

## Ordem recomendada

1. Teste A com o teu token e o teu número. Confirma `202`.
2. Teste B. Confirma que o formato `{{campo}}` + `params` chega certo.
3. Teste C na base do cliente. **Decide D ou E.**
4. Só depois disso fecho a ação e o botão dentro do zip, junto com
   `x_partner_ids` renderizado como lista no form view.
