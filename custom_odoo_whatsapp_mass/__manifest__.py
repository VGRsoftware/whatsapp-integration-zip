{
    "name": "WhatsApp Brasil - Envio em Massa",
    "summary": "Campanhas de envio em massa de mensagens WhatsApp a partir de templates",
    "description": """
WhatsApp - Envio em Massa
=========================

Adiciona duas entidades ao modulo WhatsApp Brasil Chatter Integration:

* **Template de WhatsApp** (``x_whatsapp_template``) - nome e corpo HTML da mensagem.
* **Campanha de WhatsApp** (``x_whatsapp_campaing``) - destinatarios (res.partner),
  template usado e data/hora do envio. O numero remetente e definido pelo token.

O template usa marcadores ``{{campo}}`` (campo de res.partner), no formato da
API ZapOdoo ``POST /send``. A acao de servidor de teste monta o request da API
(``message`` + ``content[]`` com ``number``/``params``, lotes de 1000) e faz o
POST quando a base expoe ``requests`` no safe_eval (o Odoo padrao nao expoe).
Parametros do sistema: ``whatsapp_mass.api_token`` e ``whatsapp_mass.api_base_url``.

This module is proprietary software and is licensed under OPL-1.
    """,
    "author": "VGR",
    # Sem prefixo de serie: o Odoo prefixa a serie corrente automaticamente
    # (adapt_version). Fixar "19.0.x" faz check_version() falhar no Odoo 20
    # e o modulo ser marcado installable=False na importacao.
    "version": "1.6.0",
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
