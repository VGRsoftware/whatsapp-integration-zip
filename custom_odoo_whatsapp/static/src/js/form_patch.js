// Odoo 20: useRef foi removido de "@web/owl2/utils". Refs agora sao signals
// criados com signal.ref(Tipo) e lidos chamando o signal (this.zapPanelRef()).
import { Chatter } from "@mail/chatter/web_portal_project/chatter";
import { patch } from "@web/core/utils/patch";
import { signal } from "@odoo/owl";

// Models com campo x_iframe (models/models.xml) onde o toggle aparece.
const ZAP_MODELS = [
  "crm.lead",
  "sale.order",
  "helpdesk.ticket",
  "project.task",
  "res.partner",
  "account.move",
];

patch(Chatter.prototype, {
  setup() {
    super.setup();
    this.zapModels = ZAP_MODELS;
    this.zapPanelRef = signal.ref(HTMLDivElement);
    this.zapChatterBtnRef = signal.ref(HTMLButtonElement);
    this.zapBtnRef = signal.ref(HTMLButtonElement);
  },

  zapToggle(view) {
    const zap = this.zapPanelRef();
    const zapBtn = this.zapBtnRef();
    const chatterBtn = this.zapChatterBtnRef();
    if (!zap || !zapBtn || !chatterBtn) {
      return;
    }
    // As divs nativas sao irmas do painel injetado; nao usamos t-ref nelas para
    // nao interferir nos refs do core.
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
