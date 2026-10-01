# API de envio — ZapOdoo

API pública para disparo de mensagens WhatsApp a partir de um número já
conectado. Autenticação por Bearer token, um token por número.

Base: `https://zap-odoo-production-1063.up.railway.app`

---

## Autenticação

Todo request leva o token do número no header:

```
Authorization: Bearer <x_api_token>
```

O token é gerado automaticamente quando o número conecta pela primeira vez e
fica no campo `x_api_token` do registro em **Whatsapp Números** (base HUB).
Ele identifica sozinho o cliente e por qual número enviar — não é preciso
passar o número na requisição.

O token sobrevive a desconexões: se o cliente reconectar o mesmo assento, o
token continua o mesmo e a integração dele não quebra.

**Erros de autenticação**

| Código | Significado |
|---|---|
| 401 | token ausente ou inválido |
| 409 | número existe, mas não está conectado ao WhatsApp no momento |
| 429 | mais de 6 requisições no último minuto |

---

## POST /send

Dispara uma mensagem para vários destinatários, com substituição de variáveis
por destinatário.

**Request**

```json
{
  "message": "Olá {{name}}, esse é um template de Whatsapp. Aqui esta seu ticket {{ticket_number}}",
  "content": [
    { "number": "+5541997795287", "params": { "name": "Gabriel", "ticket_number": 123 } },
    { "number": "+5541997795222", "params": { "name": "Gustavo", "ticket_number": 124 } }
  ]
}
```

- `message` — template com marcadores `{{chave}}`
- `content[].number` — destinatário; aceita qualquer formatação (`+55 41 99779-5287`), só os dígitos são usados
- `content[].params` — valores do template para aquele destinatário; opcional

**Substituição:** cada marcador é trocado pelo valor correspondente em
`params`. Marcador **sem** valor correspondente é mantido como está — a API
nunca inventa texto nem apaga o placeholder.

```
{{name}} com params {name: "Gabriel"}   → Gabriel
{{ticket_number}} sem esse param        → {{ticket_number}}
```

**Response `202 Accepted`**

```json
{
  "batch_id": "b3-mkq2x1a",
  "accepted": 2,
  "status_url": "/send/b3-mkq2x1a"
}
```

A resposta volta na hora; o envio acontece em segundo plano. Guarde o
`batch_id` para acompanhar o progresso.

**Limites**

| Regra | Valor |
|---|---|
| Destinatários por requisição | 1000 |
| Requisições por minuto | 6 |

**Erros de payload**

| Código | Motivo |
|---|---|
| 400 | `message` vazio, `content` não é array, array vazio, acima de 1000 itens, ou algum item sem `number` válido |

---

## GET /send/:batch_id

Progresso de um lote.

```json
{
  "batch_id": "b3-mkq2x1a",
  "total": 2,
  "pending": 0,
  "sent": 1,
  "failed": 1,
  "queued": 0,
  "items": [
    { "number": "5541997795287", "status": "sent", "error": null, "sent_at": "2026-07-29 14:20:11" },
    { "number": "5541997795222", "status": "failed", "error": "número inválido", "sent_at": "2026-07-29 14:20:15" }
  ]
}
```

| Status | Significado |
|---|---|
| `pending` | ainda na fila |
| `sent` | entregue ao WhatsApp |
| `failed` | falhou; o motivo está em `error` |

---

## Por que o envio não é instantâneo

As mensagens saem **com intervalo de 3 a 6 segundos entre elas**. Isso é
proposital: o WhatsApp bane números que disparam em rajada, e um número
banido derruba toda a operação do cliente.

O intervalo é **por número**, não global. Números diferentes enviam em
paralelo — 10 números com 1000 mensagens cada levam o mesmo tempo que 1
número com 1000 mensagens.

Referência prática: 1000 mensagens em um número levam cerca de 1h15.

Se o servidor reiniciar no meio de um disparo, o que ficou `pending` é
retomado automaticamente — nada é perdido nem enviado em duplicidade.

---

## Exemplo

```bash
curl -X POST https://zap-odoo-production-1063.up.railway.app/send \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Olá {{name}}, seu ticket é {{ticket}}",
    "content": [
      { "number": "+5541999998888", "params": { "name": "Gabriel", "ticket": 123 } }
    ]
  }'
```
