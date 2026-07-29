import { Chatter } from "@mail/chatter/web_portal/chatter";
import { patch } from "@web/core/utils/patch";
import { useRef } from "@odoo/owl";

patch(Chatter.prototype, {
  setup() {
    super.setup();
    this.zap = useRef("zap");
    this.chatterTop = useRef("chatterTop");
    this.chatterContent = useRef("chatterContent");
    this.chatterBtn = useRef("chatter-btn");
    this.zapBtn = useRef("zap-btn");
  },

  zapToggle(view) {
    const zap = this.zap.el;
    const chatterTop = this.chatterTop.el;
    const chatterContent = this.chatterContent.el;
    const zapBtn = this.zapBtn.el;
    const chatterBtn = this.chatterBtn.el;

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
