// Odoo 19.4 (saas~19.4): o componente Chatter mudou de
// "@mail/chatter/web_portal/chatter" para "@mail/chatter/web_portal_project/chatter"
// e o hook useRef passou a vir da camada de compatibilidade OWL 2 -> OWL 3.
import { Chatter } from "@mail/chatter/web_portal_project/chatter";
import { patch } from "@web/core/utils/patch";
import { useRef } from "@web/owl2/utils";
import { user } from "@web/core/user";

patch(Chatter.prototype, {
  // URL do painel. crm.lead e sale.order usam o campo computado x_iframe.
  // helpdesk.ticket monta a URL aqui no cliente: o Helpdesk e opcional e o
  // modulo nao pode referenciar nada dele nos arquivos de dados (a importacao
  // falharia em bases sem Helpdesk).
  get zapUrl() {
    const record = this.webChatterProps.record;
    if (!record) {
      return false;
    }
    if (record.data.x_iframe) {
      return record.data.x_iframe;
    }
    if (record.resModel === "helpdesk.ticket" && record.resId) {
      const partner = record.data.partner_id;
      const phone = (record.data.partner_phone || "").replace(/[\s+-]/g, "");
      return (
        "https://whatsapp-odoo.pages.dev/?partner_id=" + (partner ? partner.id : false) +
        "&contact_phone=" + phone +
        "&odoo_url=" + window.location.origin +
        "&odoo_user_id=" + user.userId
      );
    }
    return false;
  },

  setup() {
    super.setup();
    this.zapPanelRef = useRef("zap");
    this.zapChatterBtnRef = useRef("chatterBtn");
    this.zapBtnRef = useRef("zapBtn");
  },

  zapToggle(view) {
    const zap = this.zapPanelRef.el;
    const zapBtn = this.zapBtnRef.el;
    const chatterBtn = this.zapChatterBtnRef.el;
    if (!zap || !zapBtn || !chatterBtn) {
      return;
    }
    // As divs nativas sao irmas do painel injetado; nao usamos t-ref nelas para
    // nao sobrescrever o ref "top" usado pelo core.
    const root = zap.parentElement;
    const chatterTop = root.querySelector(":scope > .o-mail-Chatter-top");
    const chatterContent = root.querySelector(":scope > .o-mail-Chatter-content");
    if (!chatterTop || !chatterContent) {
      return;
    }

    if (view == "zap") {
      chatterBtn.classList.remove("btn-secondary");
      chatterBtn.classList.add("btn-primary");
      zapBtn.classList.remove("btn-primary");
      zapBtn.classList.add("btn-secondary");

      zap.classList.remove("hidden");
      chatterTop.classList.add("hidden");
      chatterContent.classList.add("hidden");
    }

    if (view == "chatter") {
      chatterBtn.classList.add("btn-secondary");
      chatterBtn.classList.remove("btn-primary");
      zapBtn.classList.add("btn-primary");
      zapBtn.classList.remove("btn-secondary");

      zap.classList.add("hidden");
      chatterTop.classList.remove("hidden");
      chatterContent.classList.remove("hidden");
    }
  },
});
