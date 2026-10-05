# WhatsApp → Helpdesk: abertura automática de tickets

> Toda mensagem WhatsApp recebida verifica se o contato já tem um ticket aberto.
> Se não tiver, um novo ticket é criado no Helpdesk, já vinculado ao contato.

---

## ⚙️ Configuração da automação

Caminho: **Configurações → Técnico → Automações → Novo**

| Campo | Valor |
|---|---|
| **Modelo** | Zap Messages (`x_whatsapp_messages`) |
| **Gatilho** | Na criação |
| **Filtro** | `[("x_direction", "=", "in")]` |
| **Ação** | Executar código Python |

---

## 🔄 Como funciona

1. Uma mensagem do tipo **recebida** (`in`) chega no Odoo.
2. O Odoo procura o **contato** cujo telefone corresponde ao número completo da mensagem, com código do país. A formatação é ignorada.
3. Se o contato **já tem ticket aberto**, nada é feito.
4. Se **não tem ticket aberto** (nenhum ticket, ou só tickets fechados):
   - cria o ticket **Whats - Novo contato**;
   - vincula o contato ao ticket;
   - coloca a mensagem recebida na descrição.
5. Se o **contato não existe**, primeiro é criado o contato **Whats Novo** com o número recebido. Esse contato é vinculado ao novo ticket.

| Situação | Resultado |
|---|---|
| Contato com ticket aberto | Nada acontece |
| Contato sem ticket, ou só com tickets fechados | Novo ticket vinculado ao contato |
| Número sem contato cadastrado | Novo contato **Whats Novo** + novo ticket |

---

## 🐍 Código Python

```python
for msg in records:
    number = (msg.x_jid or '').split('@')[0]

    # Contato com o número completo (com código do país), ignorando formatação
    partners = env['res.partner'].sudo().search([('phone', 'ilike', number[-4:])]).filtered(
        lambda p: ''.join(c for c in p.phone if c.isdigit()) == number
    )

    # Já existe ticket aberto para o contato -> não faz nada
    if partners and env['helpdesk.ticket'].sudo().search_count([
        ('partner_id', 'in', partners.ids),
        ('stage_id.fold', '=', False),
    ]):
        continue

    # Sem contato cadastrado -> cria um
    if not partners:
        partners = env['res.partner'].sudo().create({
            'name': 'Whats Novo',
            'phone': '+' + number,
        })

    env['helpdesk.ticket'].sudo().create({
        'name': 'Whats - Novo contato',
        'partner_id': partners[0].id,
        'description': msg.x_message,
    })
```

---

## ⚠️ Pontos de atenção

- **Telefone com código do país:** o contato precisa estar salvo com o DDI. Exemplo: `+55 41 99779-5287`.
- **9º dígito:** alguns números chegam do WhatsApp sem o 9 (`554197795287`). Nesse caso o número não casa com o contato salvo com o 9, e a automação cria um contato **Whats Novo** duplicado.
- **Ticket fechado:** o ticket só conta como fechado se o estágio tiver a opção **Dobrado no Kanban** marcada (ex.: *Resolvido*, *Cancelado*). Um estágio de encerramento sem essa opção é tratado como aberto.
