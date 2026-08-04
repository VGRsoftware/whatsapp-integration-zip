{
    "name": "WhatsApp Brasil Chatter Integration",
    "summary": "Adds a WhatsApp conversation panel directly inside the Odoo chatter",
    "description": """
WhatsApp Chatter Integration
===========================

This module enhances the standard Odoo chatter by allowing users to switch
between the traditional chatter and a WhatsApp conversation interface.

Main Features
-------------
* Toggle between Odoo chatter and WhatsApp conversation.
* Display WhatsApp messages inside supported documents.
* Improved communication workflow.
* Native integration with CRM and Sales.
* Designed for a seamless user experience.

This module is proprietary software and is licensed under OPL-1.
    """,
    "author": "VGR",
    # Sem prefixo de serie: o Odoo prefixa a serie corrente automaticamente
    # (adapt_version). Fixar "19.0.x" faz check_version() falhar no saas~19.4
    # e o modulo ser marcado installable=False na importacao.
    "version": "1.2.1",
    "license": "OPL-1",
    "category": "Productivity/Discuss",
    "icon": "/custom_odoo_whatsapp/static/description/icon.png",
    "images": [
        "static/description/banner.png",
        "static/description/icon.png",
    ],
    "depends": ["crm", "sale_management"],
    "data": [
        "models/models.xml",
        "models/whatsapp_models.xml",
        "models/whatsapp_messages_fields.xml",
        "views/views.xml",
        "security/security.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "custom_odoo_whatsapp/static/src/xml/view.xml",
            "custom_odoo_whatsapp/static/src/js/form_patch.js",
            "custom_odoo_whatsapp/static/src/css/toggle.css",
        ],
    },
    "installable": True,
}
