{
    "name": "WhatsApp Brasil - Envio em Massa",
    "summary": "Campanhas de envio em massa de mensagens WhatsApp a partir de templates",
    "description": """
WhatsApp - Envio em Massa
=========================

Adiciona duas entidades ao modulo WhatsApp Brasil Chatter Integration:

* **Template de WhatsApp** (``x_whatsapp_template``) - nome e corpo HTML da mensagem.
* **Campanha de WhatsApp** (``x_whatsapp_campaing``) - destinatarios (res.partner),
  template usado, numero remetente e data/hora do envio.

O disparo em si e feito pelo HUB externo, que le as campanhas agendadas via
Odoo external API. Este modulo entrega apenas o modelo de dados e a interface.

This module is proprietary software and is licensed under OPL-1.
    """,
    "author": "VGR",
    # Sem prefixo de serie: o Odoo prefixa a serie corrente automaticamente
    # (adapt_version). Fixar "19.0.x" faz check_version() falhar no saas~19.4
    # e o modulo ser marcado installable=False na importacao.
    "version": "1.0.0",
    "license": "OPL-1",
    "category": "Productivity/Discuss",
    "icon": "/custom_odoo_whatsapp_mass/static/description/icon.png",
    "images": [
        "static/description/icon.png",
    ],
    "depends": ["custom_odoo_whatsapp"],
    "data": [
        "models/mass_models.xml",
        "models/mass_fields.xml",
        "views/views.xml",
        "data/server_actions.xml",
        "security/security.xml",
    ],
    "installable": True,
}
