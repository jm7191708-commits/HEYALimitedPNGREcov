document.addEventListener("DOMContentLoaded", () => {
  const pageBody = document.body;
  const siteLoader = document.getElementById("site-loader");
  const revealSite = () => {
    if (!pageBody) return;
    pageBody.classList.remove("site-loading");
    pageBody.classList.add("site-ready");
    if (siteLoader) {
      siteLoader.setAttribute("aria-hidden", "true");
    }
  };

  if (document.readyState === "complete") {
    window.setTimeout(revealSite, 120);
  } else {
    window.addEventListener("load", () => {
      window.setTimeout(revealSite, 220);
    }, { once: true });
  }
  // ── Nav dropdown (click toggle + close on outside click / Escape) ──
  document.querySelectorAll(".nav__dropdown").forEach((dropdown) => {
    const toggle = dropdown.querySelector(".nav__dropdown-toggle");
    if (!toggle) return;

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      // close any other open dropdowns
      document.querySelectorAll(".nav__dropdown.is-open").forEach((other) => {
        if (other !== dropdown) {
          other.classList.remove("is-open");
          const otherToggle = other.querySelector(".nav__dropdown-toggle");
          if (otherToggle) otherToggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".nav__dropdown.is-open").forEach((d) => {
      d.classList.remove("is-open");
      const t = d.querySelector(".nav__dropdown-toggle");
      if (t) t.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".nav__dropdown.is-open").forEach((d) => {
        d.classList.remove("is-open");
        const t = d.querySelector(".nav__dropdown-toggle");
        if (t) t.setAttribute("aria-expanded", "false");
      });
    }
  });

  const hamburger = document.getElementById("hamburger");
  const mobileMenu = document.getElementById("mobile-menu");
  const mobileMenuClose = document.getElementById("mobile-menu-close");
  const setMenuState = (open) => {
    if (!hamburger || !mobileMenu) return;
    mobileMenu.classList.toggle("open", open);
    hamburger.classList.toggle("is-open", open);
    hamburger.setAttribute("aria-expanded", String(open));
    if (pageBody) {
      pageBody.classList.toggle("menu-open", open);
    }
  };

  const closeMenu = () => {
    if (!hamburger || !mobileMenu) return;
    setMenuState(false);
  };

  if (hamburger && mobileMenu) {
    hamburger.addEventListener("click", () => {
      const open = !mobileMenu.classList.contains("open");
      setMenuState(open);
    });

      if (mobileMenuClose) {
        mobileMenuClose.addEventListener("click", closeMenu);
      }

      mobileMenu.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMenu);
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeMenu();
      });

      document.addEventListener("click", (event) => {
        if (!mobileMenu.classList.contains("open")) return;
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (!mobileMenu.contains(target) && !hamburger.contains(target)) {
          closeMenu();
        }
      });
    }

  const contactRail = document.querySelector(".contact-rail");
  const contactRailToggle = contactRail ? contactRail.querySelector(".contact-rail__toggle") : null;
  if (contactRail && contactRailToggle) {
    const idleDelay = 180000;
    let idleTimer = null;
    let rollingTimer = null;

    const clearRailTimers = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      if (rollingTimer) window.clearTimeout(rollingTimer);
      idleTimer = null;
      rollingTimer = null;
    };

    const scheduleRailCollapse = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        contactRail.classList.add("is-rolling");
        contactRail.classList.add("is-collapsed");
        contactRailToggle.setAttribute("aria-expanded", "false");
        rollingTimer = window.setTimeout(() => {
          contactRail.classList.remove("is-rolling");
        }, 360);
      }, idleDelay);
    };

    const openContactRail = () => {
      contactRail.classList.remove("is-collapsed", "is-rolling");
      contactRailToggle.setAttribute("aria-expanded", "true");
      scheduleRailCollapse();
    };

    contactRail.classList.add("is-popping");
    window.setTimeout(() => {
      contactRail.classList.remove("is-popping");
    }, 900);

    ["pointerenter", "focusin", "pointerdown", "touchstart"].forEach((eventName) => {
      contactRail.addEventListener(eventName, openContactRail, { passive: true });
    });

    contactRailToggle.addEventListener("click", (event) => {
      event.preventDefault();
      openContactRail();
    });

    scheduleRailCollapse();

    window.addEventListener("beforeunload", clearRailTimers);
  }

  // --- Chatbot Logic ---
  const chatbotToggle = document.getElementById("chatbot-toggle");
  const chatbotClose = document.getElementById("chatbot-close");
  const chatbotWindow = document.getElementById("chatbot-window");
  const chatbotInput = document.getElementById("chatbot-input");
  const chatbotSend = document.getElementById("chatbot-send");
  const chatbotMessages = document.getElementById("chatbot-messages");

  if (chatbotToggle && chatbotWindow) {
    const toggleChat = () => {
      chatbotWindow.classList.toggle("visible");
      const isVisible = chatbotWindow.classList.contains("visible");
      chatbotWindow.setAttribute("aria-hidden", String(!isVisible));
      if (isVisible) {
        chatbotInput.focus();
      }
    };

    chatbotToggle.addEventListener("click", toggleChat);
    if (chatbotClose) chatbotClose.addEventListener("click", toggleChat);

    const appendMessage = (text, sender) => {
      const msgDiv = document.createElement("div");
      msgDiv.className = `chatbot-message chatbot-message--${sender}`;
      msgDiv.textContent = text;
      chatbotMessages.appendChild(msgDiv);
      chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    };

    const handleSend = async () => {
      const text = chatbotInput.value.trim();
      if (!text) return;

      appendMessage(text, "user");
      chatbotInput.value = "";

      // Assistant is typing delay (visual feedback)
      const typingDiv = document.createElement("div");
      typingDiv.className = "chatbot-message chatbot-message--bot typing";
      typingDiv.textContent = "...";
      chatbotMessages.appendChild(typingDiv);
      chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

      try {
        const apiUrl = (window.CHATBOT_CONFIG && window.CHATBOT_CONFIG.apiUrl) || "/api/chat";
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text })
        });
        
        const data = await response.json();
        chatbotMessages.removeChild(typingDiv);
        
        if (data.ok) {
          appendMessage(data.response, "bot");
        } else {
          appendMessage("I'm sorry, I'm having trouble connecting right now. Please try again later.", "bot");
        }
      } catch (error) {
        if (chatbotMessages.contains(typingDiv)) {
          chatbotMessages.removeChild(typingDiv);
        }
        appendMessage("Connection error. Please check your internet and try again.", "bot");
      }
    };

    chatbotSend.addEventListener("click", handleSend);
    chatbotInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleSend();
    });
  }
  // --- End Chatbot Logic ---

  const params = new URLSearchParams(window.location.search);

  const prefillAdvertiseForm = () => {
    const packageInput = document.getElementById("packageInterest");
    const jobTitleInput = document.querySelector('#advertise-form input[name="jobTitle"]');

    if (packageInput && params.get("package")) {
      packageInput.value = params.get("package");
    }

    if (jobTitleInput && params.get("jobTitle")) {
      jobTitleInput.value = params.get("jobTitle");
    }
  };

  const prefillContactForm = () => {
    const contactForm = document.getElementById("contact-form") || document.getElementById("contactForm");
    if (!contactForm) return;

    const serviceSelect = contactForm.querySelector('[name="serviceNeeded"]');
    const intentField   = document.getElementById("career-intent");
    const jobPostingField = document.getElementById("job-posting-id");
    const messageField  = contactForm.querySelector('[name="message"]');
    const role = params.get("role");
    const ref  = params.get("ref");
    const intent = params.get("intent");
    const jobId  = params.get("jobId");

    if (intentField)    intentField.value    = intent || "";
    if (jobPostingField && jobId) jobPostingField.value = jobId;

    // --- Career fields visibility: driven ONLY by the select dropdown ---
    const careerFields = contactForm.querySelectorAll(".career-only");

    const showCareerFields = (show) => {
      careerFields.forEach((el) => {
        if (show) {
          el.hidden = false;
          el.classList.remove("career-reveal");
          void el.offsetWidth; // force reflow so animation restarts cleanly
          el.classList.add("career-reveal");
        } else {
          el.hidden = true;
          el.classList.remove("career-reveal");
        }
      });
    };

    // Start hidden no matter what
    showCareerFields(false);

    if (serviceSelect) {
      serviceSelect.addEventListener("change", () => {
        showCareerFields(serviceSelect.value === "Job Application / CV Submission");
      });

      // If URL intent routed here, pre-select the dropdown then trigger visibility
      if ((intent === "job-application" || intent === "jobseeker-cv") && !serviceSelect.value) {
        serviceSelect.value = "Job Application / CV Submission";
        showCareerFields(true);
      } else if (intent === "employer-enquiry" && !serviceSelect.value) {
        serviceSelect.value = "Talent Acquisition";
      }
    }

    // Pre-fill message body based on URL intent
    if (!messageField || messageField.value) return;
    if (intent === "job-application" && role) {
      const referenceLine = ref ? `Reference: ${ref}\n` : "";
      messageField.value = `I would like to apply for the role of ${role}.\n${referenceLine}Please find my expression of interest below:\n`;
    } else if (intent === "jobseeker-cv") {
      messageField.value = "I would like to submit my CV to the HEYA Talent Solutions candidate pool. Please let me know the next steps.\n";
    } else if (intent === "employer-enquiry") {
      messageField.value = "I would like to discuss recruitment support for an upcoming hiring need.\n";
    }
  };

  const setupContactFilePickers = () => {
    document.querySelectorAll(".contact-file-input").forEach((input) => {
      input.addEventListener("change", () => {
        const field  = input.closest(".contact-file-field");
        const nameEl = field?.querySelector(".contact-file-name");
        const plusBtn = field?.querySelector(".plusButton");
        const file = input.files?.[0];
        if (file) {
          const label = file.name.length > 22 ? file.name.slice(0, 20) + "…" : file.name;
          if (nameEl)  { nameEl.textContent = label; nameEl.classList.add("has-file"); }
          if (plusBtn) plusBtn.classList.add("has-file");
        } else {
          if (nameEl)  { nameEl.textContent = "No file chosen"; nameEl.classList.remove("has-file"); }
          if (plusBtn) plusBtn.classList.remove("has-file");
        }
      });
    });
  };

  const setupVacancyFilters = () => {
    const grid = document.getElementById("job-grid");
    const noResults = document.getElementById("no-results");
    const counter = document.getElementById("job-count");
    const cards = Array.from(grid ? grid.querySelectorAll(".job-card") : []);
    const selects = Array.from(document.querySelectorAll(".filter-select"));
    const clearButton = document.getElementById("clear-filters");

    if (!grid || !cards.length || !selects.length) return;

    const defaults = {
      industry: "All Industries",
      location: "All Locations",
      type: "All Types",
      level: "All Levels"
    };
    const filters = { ...defaults };

    const applyFilters = () => {
      let visible = 0;

      cards.forEach((card) => {
        const matches = Object.entries(filters).every(([key, value]) => {
          if (value === defaults[key]) return true;
          return card.dataset[key] === value;
        });

        card.hidden = !matches;
        if (matches) visible += 1;
      });

      if (counter) counter.textContent = String(visible);
      if (noResults) noResults.hidden = visible > 0;
    };

    selects.forEach((select) => {
      select.addEventListener("change", () => {
        filters[select.dataset.filter] = select.value;
        applyFilters();
      });
    });

    if (clearButton) {
      clearButton.addEventListener("click", () => {
        selects.forEach((select) => {
          select.selectedIndex = 0;
          filters[select.dataset.filter] = select.options[0].value;
        });
        applyFilters();
      });
    }
  };

  const setupIndustryShowcase = () => {
    const viewport = document.querySelector("[data-industry-showcase]");
    const prevButton = document.querySelector("[data-industry-showcase-prev]");
    const nextButton = document.querySelector("[data-industry-showcase-next]");
    const cards = viewport ? Array.from(viewport.querySelectorAll(".industry-showcase-card")) : [];

    if (!viewport || !prevButton || !nextButton || !cards.length) return;

    let index = 0;
    let autoTimer = null;
    let syncing = false;

    const originalsCount = cards.length;

    const makeClone = (card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.classList.add("industry-showcase-card--clone");
      return clone;
    };

    cards.slice().reverse().forEach((card) => {
      viewport.insertBefore(makeClone(card), viewport.firstChild);
    });

    cards.forEach((card) => {
      viewport.appendChild(makeClone(card));
    });

    const getStep = () => {
      const visibleCards = Array.from(viewport.querySelectorAll(".industry-showcase-card"));
      if (visibleCards.length < 2) {
        return visibleCards[0] ? visibleCards[0].offsetWidth : viewport.clientWidth;
      }
      const first = visibleCards[0].getBoundingClientRect();
      const second = visibleCards[1].getBoundingClientRect();
      return Math.max(visibleCards[0].offsetWidth, second.left - first.left);
    };

    const baseOffset = () => getStep() * originalsCount;

    const normalizeScroll = () => {
      const step = getStep();
      const min = step * 0.5;
      const max = step * (originalsCount * 2 + 0.5);

      if (viewport.scrollLeft < min) {
        syncing = true;
        viewport.scrollLeft += step * originalsCount;
        syncing = false;
      } else if (viewport.scrollLeft > max) {
        syncing = true;
        viewport.scrollLeft -= step * originalsCount;
        syncing = false;
      }
    };

    const scrollToIndex = (targetIndex, behavior = "smooth") => {
      index = (targetIndex + originalsCount) % originalsCount;
      viewport.scrollTo({
        left: baseOffset() + getStep() * index,
        behavior
      });
    };

    const startAuto = () => {
      if (autoTimer) window.clearInterval(autoTimer);
      autoTimer = window.setInterval(() => {
        scrollToIndex(index + 1);
      }, 3200);
    };

    const stopAuto = () => {
      if (!autoTimer) return;
      window.clearInterval(autoTimer);
      autoTimer = null;
    };

    prevButton.addEventListener("click", () => {
      scrollToIndex(index - 1);
      startAuto();
    });

    nextButton.addEventListener("click", () => {
      scrollToIndex(index + 1);
      startAuto();
    });

    ["pointerenter", "focusin", "touchstart"].forEach((eventName) => {
      viewport.addEventListener(eventName, stopAuto, { passive: true });
    });

    ["pointerleave", "focusout", "touchend"].forEach((eventName) => {
      viewport.addEventListener(eventName, startAuto, { passive: true });
    });

    window.addEventListener("resize", () => {
      scrollToIndex(index, "auto");
    }, { passive: true });

    viewport.addEventListener("scroll", () => {
      if (syncing) return;
      normalizeScroll();
    }, { passive: true });

    scrollToIndex(0, "auto");
    startAuto();
  };

  const initSiteSearch = () => {
    const btn = document.getElementById("headerSearchBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const chatWindow   = document.getElementById("chatbot-window");
      const chatMessages = document.getElementById("chatbot-messages");
      const chatInput    = document.getElementById("chatbot-input");
      if (!chatWindow) return;

      if (!chatWindow.classList.contains("visible")) {
        chatWindow.classList.add("visible");
        chatWindow.setAttribute("aria-hidden", "false");
      }

      if (chatMessages) {
        const msg = document.createElement("div");
        msg.className = "chatbot-message chatbot-message--bot";
        msg.textContent = "What are you looking for? I can help you find services, careers, job vacancies, packages, and more on HEYA Talent Solutions — just tell me what you need!";
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }

      if (chatInput) chatInput.focus();
    });
  };

  const setupPortalRequestFlows = () => {
    const openButtons = Array.from(document.querySelectorAll("[data-portal-open-form]"));
    const cancelButtons = Array.from(document.querySelectorAll("[data-portal-cancel-form]"));
    if (!openButtons.length) return;

    const defaultSections = Array.from(document.querySelectorAll("[data-portal-default]"));
    const forms = Array.from(document.querySelectorAll("[data-portal-form]"));

    const setPortalMode = (targetName = "") => {
      const opening = Boolean(targetName);
      defaultSections.forEach((section) => {
        section.hidden = opening;
      });
      forms.forEach((section) => {
        section.hidden = section.getAttribute("data-portal-form") !== targetName;
      });
      document.body.classList.toggle("portal-form-active", opening);

      const target = opening
        ? document.querySelector(`[data-portal-form="${targetName}"]`)
        : document.querySelector("[data-portal-default]");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    openButtons.forEach((button) => {
      button.addEventListener("click", () => setPortalMode(button.getAttribute("data-portal-open-form")));
    });

    cancelButtons.forEach((button) => {
      button.addEventListener("click", () => setPortalMode(""));
    });
  };

  const setupHeroImageGuardrails = () => {
    document.querySelectorAll(".hero--workforce").forEach((hero) => {
      const image = hero.querySelector(".hero__cover-image");
      let fallbackLocked = false;
      if (!image) {
        hero.classList.add("hero--image-fallback");
        return;
      }

      const markLoaded = () => {
        hero.classList.remove("hero--image-fallback");
        hero.classList.add("hero--image-ready");
      };

      const markFailed = () => {
        fallbackLocked = true;
        hero.classList.remove("hero--image-ready");
        hero.classList.add("hero--image-fallback");
      };

      const checkLayout = () => {
        if (fallbackLocked) return;
        const heroBox = hero.getBoundingClientRect();
        const hasHeroOverflow = heroBox.left < -2 || heroBox.right > window.innerWidth + 2;
        if (hasHeroOverflow) {
          markFailed();
        }
      };

      image.addEventListener("load", () => {
        markLoaded();
        window.requestAnimationFrame(checkLayout);
      }, { once: true });
      image.addEventListener("error", markFailed, { once: true });
      window.addEventListener("resize", () => window.requestAnimationFrame(checkLayout), { passive: true });

      if (image.complete) {
        if (image.naturalWidth > 0) {
          markLoaded();
          window.requestAnimationFrame(checkLayout);
        }
        else markFailed();
      }
    });
  };

  prefillAdvertiseForm();
  prefillContactForm();
  setupContactFilePickers();
  setupVacancyFilters();
  setupIndustryShowcase();
  setupPortalRequestFlows();
  initSiteSearch();
  setupHeroImageGuardrails();

  document.querySelectorAll("[data-skill-builder]").forEach((skillBuilder) => {
    const skillInput = skillBuilder.querySelector(".skill-builder__input");
    const addBtn = skillBuilder.querySelector(".skill-builder__add-btn");
    const list = skillBuilder.querySelector(".skill-builder__list");
    const hiddenInput = skillBuilder.querySelector(".skill-builder__value");
    if (!skillInput || !addBtn || !list || !hiddenInput) return;
    const skills = [];

    const syncValue = () => { hiddenInput.value = skills.join(", "); };

    const addSkill = () => {
      const val = skillInput.value.trim();
      if (!val || skills.includes(val)) { skillInput.focus(); return; }
      skills.push(val);
      skillInput.value = "";
      skillInput.focus();

      const li = document.createElement("li");
      li.className = "skill-builder__item";
      li.innerHTML = `<span>${val}</span><button type="button" class="skill-builder__remove" aria-label="Remove ${val}">&times;</button>`;
      li.querySelector(".skill-builder__remove").addEventListener("click", () => {
        skills.splice(skills.indexOf(val), 1);
        li.remove();
        syncValue();
      });
      list.appendChild(li);
      syncValue();
    };

    addBtn.addEventListener("click", addSkill);
    skillInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } });
  });

  const appInstrToggle = document.getElementById("appInstrModeToggle");
  if (appInstrToggle) {
    const field = appInstrToggle.closest(".app-instr-field");
    const textArea = field?.querySelector(".app-instr-field__text");
    const uploadWrap = field?.querySelector(".app-instr-field__upload");
    const fileInput = uploadWrap?.querySelector(".file-upload-input");
    const labels = field?.querySelectorAll(".app-instr-field__mode-label");

    const applyMode = (uploadMode) => {
      if (textArea) { textArea.hidden = uploadMode; textArea.disabled = uploadMode; if (!uploadMode) textArea.required = true; else textArea.required = false; }
      if (uploadWrap) uploadWrap.hidden = !uploadMode;
      if (fileInput) fileInput.disabled = !uploadMode;
      if (labels) { labels[0].classList.toggle("is-active", !uploadMode); labels[1].classList.toggle("is-active", uploadMode); }
    };

    applyMode(appInstrToggle.checked);
    appInstrToggle.addEventListener("change", () => applyMode(appInstrToggle.checked));
  }

  document.querySelectorAll(".file-upload-input").forEach((input) => {
    const btn = input.closest(".file-upload-wrap")?.querySelector(".file-upload-btn");
    if (!btn) return;
    const textEl = btn.querySelector(".file-upload-btn__text");
    const iconEl = btn.querySelector(".file-upload-btn__icon");
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) {
        const name = file.name.length > 18 ? file.name.slice(0, 16) + "…" : file.name;
        if (textEl) textEl.textContent = name;
        if (iconEl) iconEl.textContent = "✓";
        btn.classList.add("has-file");
      } else {
        if (textEl) textEl.textContent = "Choose file";
        if (iconEl) iconEl.textContent = "+";
        btn.classList.remove("has-file");
      }
    });
  });

  document.querySelectorAll(".toggle-field__check").forEach((checkbox) => {
    const body = checkbox.closest(".toggle-field")?.querySelector(".toggle-field__body");
    if (!body) return;
    body.classList.toggle("is-hidden", !checkbox.checked);
    checkbox.addEventListener("change", () => {
      body.classList.toggle("is-hidden", !checkbox.checked);
    });
  });

  const setStatus = (form, message, state) => {
    const status = form.querySelector(".form-status");
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  };

  const readFileAsUpload = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const [, contentBase64 = ""] = result.split(",", 2);
      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        contentBase64
      });
    };
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });

  const buildJsonPayload = async (form) => {
    const formData = new FormData(form);
    const payload = {};

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        if (!value.name || value.size === 0) continue;
        if (key === "cvFile") {
          payload.cvUpload = await readFileAsUpload(value);
        } else if (key === "coverLetterFile") {
          payload.coverLetterUpload = await readFileAsUpload(value);
        } else if (key === "applicationInstructionsFile") {
          payload.applicationInstructionsUpload = await readFileAsUpload(value);
        } else if (key === "idPhotoFile") {
          payload.idPhotoUpload = await readFileAsUpload(value);
        }
        continue;
      }

      payload[key] = value;
    }

    return payload;
  };

  const submitJson = async (form, endpoint, successMessage) => {
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    const submitLabel = submit ? submit.querySelector("[data-submit-label]") : null;
    const originalLabel = submitLabel
      ? submitLabel.textContent
      : (submit ? submit.textContent : "");
    const payload = await buildJsonPayload(form);

    if (submit) {
      submit.disabled = true;
      if (submitLabel) {
        submitLabel.textContent = "Submitting...";
      } else {
        submit.textContent = "Submitting...";
      }
    }
    setStatus(form, "Sending...", "loading");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Something went wrong. Please try again.");
      }
      form.reset();
      setStatus(form, result.message || successMessage, "success");
    } catch (error) {
      setStatus(form, error.message || "Unable to send. Please try again.", "error");
    } finally {
      if (submit) {
        submit.disabled = false;
        if (submitLabel) {
          submitLabel.textContent = originalLabel;
        } else {
          submit.textContent = originalLabel;
        }
      }
    }
  };

  const contactForm = document.getElementById("contact-form") || document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const serviceSelect = contactForm.querySelector('[name="serviceNeeded"]');
      const selectedService = serviceSelect ? serviceSelect.value : "";

      if (selectedService === "Job Application / CV Submission") {
        // Validate CV is attached before hitting the database route
        const cvInput = contactForm.querySelector('[name="cvFile"]');
        if (!cvInput || !cvInput.files || !cvInput.files.length) {
          setStatus(contactForm, "Please attach your CV before submitting.", "error");
          return;
        }
        // Route to careers database
        submitJson(contactForm, "/api/careers/talent-pool", "Your application has been submitted to our talent pool.");
      } else {
        // Route to email/contact API
        submitJson(contactForm, "/api/contact", "Thank you. Your enquiry has been received.");
      }
    });
  }

  // ── Job Application Modal (injected on demand) ──
  const initApplyModal = () => {
    const buildApplyModal = (jobId, jobTitle, jobCompany, jobLocation, jobType, jobRef, coverRequired) => {
      const coverStar = coverRequired === "true" ? " *" : "";
      return `
        <div class="apply-modal__backdrop" data-apply-close></div>
        <div class="apply-modal__panel" role="dialog" aria-modal="true" aria-labelledby="apply-modal-title">
          <div class="apply-modal__header">
            <div class="apply-modal__header-info">
              <p class="eyebrow eyebrow--gold" style="margin:0 0 0.2rem;">Job Application</p>
              <h2 id="apply-modal-title" class="apply-modal__title">${jobTitle}</h2>
              <p class="apply-modal__meta">
                <span><i class="fa-solid fa-building" aria-hidden="true"></i> ${jobCompany}</span>
                <span><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${jobLocation}</span>
                <span><i class="fa-solid fa-briefcase" aria-hidden="true"></i> ${jobType}</span>
                <span><i class="fa-solid fa-hashtag" aria-hidden="true"></i> ${jobRef}</span>
              </p>
            </div>
            <button class="apply-modal__close" type="button" aria-label="Close application form" data-apply-close>
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
          <div class="apply-modal__body">
            <div class="apply-sheet-tools apply-sheet-tools--vacancy">
              <div>
                <p class="job-modal__section-title apply-sheet-eyebrow">
                  <i class="fa-solid fa-paper-plane" aria-hidden="true"></i> How to Apply
                </p>
                <h3 class="apply-sheet-title">Submit your application</h3>
                <p class="apply-sheet-copy">Complete the application sheet below, then attach the required files before submitting.</p>
              </div>
            </div>
            <form id="job-application-form" class="form" method="post"
              action="/api/careers/jobs/${jobId}/apply"
              data-job-id="${jobId}" novalidate>
              <div class="apply-form-section">
                <p class="job-modal__section-title">
                  <i class="fa-solid fa-id-card" aria-hidden="true"></i> Applicant Details
                </p>
              <div class="form-grid apply-manual-grid">
                <label class="apply-field-wide">
                  <span>Full Name *</span>
                  <input type="text" name="fullName" autocomplete="name" placeholder="e.g. Maria Kave" required />
                </label>
                <label>
                  <span>Email Address *</span>
                  <input type="email" name="email" autocomplete="email" placeholder="candidate@email.com" required />
                </label>
                <label>
                  <span>Phone Number *</span>
                  <input type="tel" name="phone" autocomplete="tel" placeholder="+675 7XXX XXXX" required />
                </label>
                <label class="apply-field-wide">
                  <span>Position *</span>
                  <input type="text" value="${jobTitle}${jobCompany ? ` &mdash; ${jobCompany}` : ""}" readonly />
                </label>
                <label>
                  <span>Current Location</span>
                  <input type="text" name="currentLocation" placeholder="e.g. Port Moresby, NCD" />
                </label>
                <label>
                  <span>Years of Experience</span>
                  <input type="text" name="yearsExperience" placeholder="e.g. 5 years" />
                </label>
                <label class="apply-field-wide">
                  <span>Notes / Cover Letter</span>
                  <textarea name="message" rows="4" placeholder="Any relevant notes about this application..."></textarea>
                </label>
              </div>
              </div>
              <div class="apply-form-section">
                <p class="job-modal__section-title">
                  <i class="fa-solid fa-file-arrow-up" aria-hidden="true"></i> Required Files
                </p>
              <div class="contact-file-row">
                <div class="contact-file-field">
                  <span class="contact-file-label">CV / Resume *</span>
                  <input type="file" name="cvFile" accept=".pdf,.doc,.docx,.rtf,.txt" class="contact-file-input" id="modalCvFile" />
                  <label for="modalCvFile" class="contact-file-trigger" tabindex="0">
                    <div class="plusButton" aria-hidden="true">
                      <svg class="plusIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30">
                        <path d="M13.75 23.75V16.25H6.25V13.75H13.75V6.25H16.25V13.75H23.75V16.25H16.25V23.75H13.75Z"></path>
                      </svg>
                    </div>
                    <span class="contact-file-name">No file chosen</span>
                  </label>
                </div>
                <div class="contact-file-field">
                  <span class="contact-file-label">ID Photo *</span>
                  <input type="file" name="idPhotoFile" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                    class="contact-file-input" id="modalIdPhoto" />
                  <label for="modalIdPhoto" class="contact-file-trigger" tabindex="0">
                    <div class="plusButton" aria-hidden="true">
                      <svg class="plusIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30">
                        <path d="M13.75 23.75V16.25H6.25V13.75H13.75V6.25H16.25V13.75H23.75V16.25H16.25V23.75H13.75Z"></path>
                      </svg>
                    </div>
                    <span class="contact-file-name">No file chosen</span>
                  </label>
                </div>
              </div>
              <div class="app-instr-field" ${coverRequired === "true" ? 'data-cover-required="true"' : ""}>
                <div class="app-instr-field__head">
                  <span class="app-instr-field__label">Cover Letter${coverStar}</span>
                  <div class="app-instr-field__mode">
                    <span class="app-instr-field__mode-label">Write</span>
                    <label class="switch switch--sm" aria-label="Switch between writing and uploading cover letter">
                      <input type="checkbox" id="coverLetterModeToggle" checked>
                      <span class="slider"></span>
                    </label>
                    <span class="app-instr-field__mode-label is-active">Upload file</span>
                  </div>
                </div>
                <textarea name="coverLetterText" class="app-instr-field__text" rows="5"
                  placeholder="Write your cover letter here..." hidden disabled></textarea>
                <div class="app-instr-field__upload contact-file-field">
                  <input type="file" name="coverLetterFile" accept=".pdf,.doc,.docx,.rtf,.txt"
                    class="contact-file-input" id="modalCoverFile" />
                  <label for="modalCoverFile" class="contact-file-trigger" tabindex="0">
                    <div class="plusButton" aria-hidden="true">
                      <svg class="plusIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30">
                        <path d="M13.75 23.75V16.25H6.25V13.75H13.75V6.25H16.25V13.75H23.75V16.25H16.25V23.75H13.75Z"></path>
                      </svg>
                    </div>
                    <span class="contact-file-name">No file chosen</span>
                  </label>
                </div>
              </div>
              </div>
              <button class="cta" type="submit">
                <span class="span" data-submit-label>Submit Application</span>
                <span class="second" aria-hidden="true">
                  <svg width="50px" height="20px" viewBox="0 0 66 43" xmlns="http://www.w3.org/2000/svg">
                    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                      <path class="one" d="M40.1543933,3.89485454 L43.9763149,0.139296592 C44.1708311,-0.0518420739 44.4826329,-0.0518571125 44.6771675,0.139262789 L65.6916134,20.7848311 C66.0855801,21.1718824 66.0911863,21.8050225 65.704135,22.1989893 C65.7000188,22.2031791 65.6958657,22.2073326 65.6916762,22.2114492 L44.677098,42.8607841 C44.4825957,43.0519059 44.1708242,43.0519358 43.9762853,42.8608513 L40.1545186,39.1069479 C39.9575152,38.9134427 39.9546793,38.5968729 40.1481845,38.3998695 C40.1502893,38.3977268 40.1524132,38.395603 40.1545562,38.3934985 L56.9937789,21.8567812 C57.1908028,21.6632968 57.193672,21.3467273 57.0001876,21.1497035 C56.9980647,21.1475418 56.9959223,21.1453995 56.9937605,21.1432767 L40.1545208,4.60825197 C39.9574869,4.41477773 39.9546013,4.09820839 40.1480756,3.90117456 C40.1501626,3.89904911 40.1522686,3.89694235 40.1543933,3.89485454 Z" fill="#FFFFFF"></path>
                      <path class="two" d="M20.1543933,3.89485454 L23.9763149,0.139296592 C24.1708311,-0.0518420739 24.4826329,-0.0518571125 24.6771675,0.139262789 L45.6916134,20.7848311 C46.0855801,21.1718824 46.0911863,21.8050225 45.704135,22.1989893 C45.7000188,22.2031791 45.6958657,22.2073326 45.6916762,22.2114492 L24.677098,42.8607841 C24.4825957,43.0519059 24.1708242,43.0519358 23.9762853,42.8608513 L20.1545186,39.1069479 C19.9575152,38.9134427 19.9546793,38.5968729 20.1481845,38.3998695 C20.1502893,38.3977268 20.1524132,38.395603 20.1545562,38.3934985 L36.9937789,21.8567812 C37.1908028,21.6632968 37.193672,21.3467273 37.0001876,21.1497035 C36.9980647,21.1475418 36.9959223,21.1453995 36.9937605,21.1432767 L20.1545208,4.60825197 C19.9574869,4.41477773 19.9546013,4.09820839 20.1480756,3.90117456 C20.1501626,3.89904911 20.1522686,3.89694235 20.1543933,3.89485454 Z" fill="#FFFFFF"></path>
                      <path class="three" d="M0.154393339,3.89485454 L3.97631488,0.139296592 C4.17083111,-0.0518420739 4.48263286,-0.0518571125 4.67716753,0.139262789 L25.6916134,20.7848311 C26.0855801,21.1718824 26.0911863,21.8050225 25.704135,22.1989893 C25.7000188,22.2031791 25.6958657,22.2073326 25.6916762,22.2114492 L4.67709797,42.8607841 C4.48259567,43.0519059 4.17082418,43.0519358 3.97628526,42.8608513 L0.154518591,39.1069479 C-0.0424848215,38.9134427 -0.0453206733,38.5968729 0.148184538,38.3998695 C0.150289256,38.3977268 0.152413239,38.395603 0.154556228,38.3934985 L16.9937789,21.8567812 C17.1908028,21.6632968 17.193672,21.3467273 17.0001876,21.1497035 C16.9980647,21.1475418 16.9959223,21.1453995 16.9937605,21.1432767 L0.15452076,4.60825197 C-0.0425130651,4.41477773 -0.0453986756,4.09820839 0.148075568,3.90117456 C0.150162624,3.89904911 0.152268631,3.89694235 0.154393339,3.89485454 Z" fill="#FFFFFF"></path>
                    </g>
                  </svg>
                </span>
              </button>
              <p class="form-status" role="status" aria-live="polite"></p>
            </form>
          </div>
        </div>`;
    };

    const mountModal = (job) => {
      const jobId        = job.id || "";
      const coverRequired = job.coverLetterRequired ? "true" : "false";

      const existing = document.getElementById("apply-modal");
      if (existing) existing.remove();

      const jobDetailModal = document.getElementById("jobModal");
      if (jobDetailModal && jobDetailModal.classList.contains("is-open")) {
        jobDetailModal.classList.remove("is-open");
        document.body.style.overflow = "";
      }

      const modal = document.createElement("div");
      modal.id = "apply-modal";
      modal.className = "apply-modal";
      modal.setAttribute("aria-hidden", "false");
      modal.innerHTML = buildApplyModal(
        jobId,
        job.title    || "",
        job.company  || "",
        job.location || "",
        job.type     || "",
        job.ref      || "",
        coverRequired
      );
      document.body.appendChild(modal);
      document.body.classList.add("apply-modal-open");

      modal.querySelectorAll(".contact-file-input").forEach((input) => {
        input.addEventListener("change", () => {
          const field   = input.closest(".contact-file-field");
          const nameEl  = field?.querySelector(".contact-file-name");
          const plusBtn = field?.querySelector(".plusButton");
          if (nameEl)  nameEl.textContent = input.files?.[0]?.name || "No file chosen";
          if (plusBtn) plusBtn.classList.toggle("has-file", Boolean(input.files?.length));
        });
      });

      const coverToggle = modal.querySelector("#coverLetterModeToggle");
      if (coverToggle) {
        const clField    = coverToggle.closest(".app-instr-field");
        const clTextArea = clField?.querySelector(".app-instr-field__text");
        const clUpload   = clField?.querySelector(".app-instr-field__upload");
        const clFile     = clUpload?.querySelector('[name="coverLetterFile"]');
        const clLabels   = clField?.querySelectorAll(".app-instr-field__mode-label");

        const applyCoverMode = (uploadMode) => {
          if (clTextArea) { clTextArea.hidden = uploadMode; clTextArea.disabled = uploadMode; }
          if (clUpload)   clUpload.hidden = !uploadMode;
          if (clFile)     clFile.disabled = !uploadMode;
          if (clLabels)   { clLabels[0].classList.toggle("is-active", !uploadMode); clLabels[1].classList.toggle("is-active", uploadMode); }
        };

        applyCoverMode(coverToggle.checked);
        coverToggle.addEventListener("change", () => applyCoverMode(coverToggle.checked));
      }

      const form = modal.querySelector("#job-application-form");
      if (form) {
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          const cvInput    = form.querySelector('[name="cvFile"]');
          const coverInput = form.querySelector('[name="coverLetterFile"]');
          const idPhotoInput = form.querySelector('[name="idPhotoFile"]');
          if (!cvInput || !cvInput.files || !cvInput.files.length) {
            setStatus(form, "Please attach your CV before submitting.", "error");
            return;
          }
          const clField = form.querySelector(".app-instr-field[data-cover-required='true']");
          if (clField) {
            const isUpload = form.querySelector("#coverLetterModeToggle")?.checked ?? true;
            if (isUpload && (!coverInput?.files || !coverInput.files.length)) {
              setStatus(form, "Please attach the required cover letter before submitting.", "error");
              return;
            }
            if (!isUpload && !form.querySelector('[name="coverLetterText"]')?.value?.trim()) {
              setStatus(form, "Please write your cover letter before submitting.", "error");
              return;
            }
          }
          if (!idPhotoInput || !idPhotoInput.files || !idPhotoInput.files.length) {
            setStatus(form, "Please attach your ID photo before submitting.", "error");
            return;
          }
          submitJson(form, `/api/careers/jobs/${encodeURIComponent(jobId)}/apply`, "Your application has been submitted. We will be in touch if you are shortlisted.");
        });
      }

      const closeModal = () => {
        modal.classList.add("apply-modal--closing");
        modal.addEventListener("animationend", () => {
          modal.remove();
          document.body.classList.remove("apply-modal-open");
        }, { once: true });
      };

      modal.querySelectorAll("[data-apply-close]").forEach((el) => {
        el.addEventListener("click", closeModal);
      });

      document.addEventListener("keydown", function onEsc(e) {
        if (e.key === "Escape") { closeModal(); document.removeEventListener("keydown", onEsc); }
      });

      requestAnimationFrame(() => {
        const first = modal.querySelector("input");
        if (first) first.focus();
      });
    };

    const openApplyModal = async (btn) => {
      const jobId = btn.dataset.jobId;
      if (!jobId) return;

      // Show a loading state on the button
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = "Loading…";

      try {
        const res  = await fetch(`/api/careers/jobs/${encodeURIComponent(jobId)}`);
        const data = await res.json();
        if (!data.ok || !data.job) throw new Error("Position unavailable.");
        mountModal(data.job);
      } catch {
        btn.innerHTML  = originalText;
        btn.disabled   = false;
      } finally {
        btn.innerHTML  = originalText;
        btn.disabled   = false;
      }
    };

    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-apply-job]");
      if (btn) openApplyModal(btn);
    });
  };

  initApplyModal();

  const advertiseForm = document.getElementById("advertise-form") || document.getElementById("advertiseForm");
  if (advertiseForm) {
    advertiseForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const skillsValue = advertiseForm.querySelector('[name="requiredSkills"]');
      if (!skillsValue || !skillsValue.value.trim()) {
        setStatus(advertiseForm, "Please add at least one required skill.", "error");
        advertiseForm.querySelector("#employerSkillBuilder .skill-builder__input")?.focus();
        return;
      }
      const instrToggle = advertiseForm.querySelector("#appInstrModeToggle");
      const uploadMode = instrToggle?.checked;
      const instrText = advertiseForm.querySelector('[name="applicationInstructions"]');
      const instrFile = advertiseForm.querySelector('[name="applicationInstructionsFile"]');
      if (uploadMode && (!instrFile || !instrFile.files.length)) {
        setStatus(advertiseForm, "Please upload the application instructions file.", "error");
        return;
      }
      if (!uploadMode && (!instrText || !instrText.value.trim())) {
        setStatus(advertiseForm, "Please provide application instructions.", "error");
        instrText?.focus();
        return;
      }
      submitJson(advertiseForm, "/api/careers/employer-submissions", "Your vacancy request has been submitted.");
    });
  }

  const talentPoolForm = document.getElementById("talent-pool-form");
  if (talentPoolForm) {
    talentPoolForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const cvFile = talentPoolForm.querySelector('[name="cvFile"]');
      const skillsValue = talentPoolForm.querySelector('[name="keySkills"]');
      if (!skillsValue || !skillsValue.value.trim()) {
        setStatus(talentPoolForm, "Please add at least one key skill.", "error");
        document.querySelector("#skillBuilder .skill-builder__input")?.focus();
        return;
      }
      if (!cvFile || !cvFile.files.length) {
        setStatus(talentPoolForm, "Please upload your CV.", "error");
        return;
      }
      submitJson(talentPoolForm, "/api/careers/talent-pool", "Your talent profile has been submitted.");
    });
  }
});

(() => {
  const initWireframeCanvas = (canvas) => {
    if (!canvas) return;

    const context = canvas.getContext("2d");
    const hero = canvas.closest(".hero, .page-hero");
    if (!context || !hero) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = {
      active: false,
      x: 0,
      y: 0
    };

    let width = 0;
    let height = 0;
    let points = [];
    let frame = null;
    let resizeTimer = null;

    const settings = {
      density: 26000,
      minPoints: 34,
      maxPoints: 74,
      maxEdge: 178,
      pointerEdge: 210,
      wireBase: 0.9,
      wireBoost: 0.95
    };

    const random = (min, max) => Math.random() * (max - min) + min;

    const applyLayer = () => {
      canvas.hidden = false;

      if (window.getComputedStyle(hero).position === "static") {
        hero.style.position = "relative";
      }
      hero.style.overflow = "hidden";
      hero.style.isolation = "isolate";

      Object.assign(canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        zIndex: "0",
        pointerEvents: "none",
        opacity: "0.46"
      });

      Array.from(hero.children).forEach((child) => {
        if (child === canvas) return;
        if (window.getComputedStyle(child).position === "static") {
          child.style.position = "relative";
        }
        child.style.zIndex = "1";
      });
    };

    const createPoints = () => {
      const count = Math.round(Math.min(settings.maxPoints, Math.max(settings.minPoints, (width * height) / settings.density)));
      points = Array.from({ length: count }, () => ({
        x: random(-20, width + 20),
        y: random(-20, height + 20),
        vx: random(-0.14, 0.14),
        vy: random(-0.12, 0.12),
        radius: random(0.8, 1.8)
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      createPoints();
    };

    const nearest = (point, limit = 3) => points
      .filter((candidate) => candidate !== point)
      .map((candidate) => ({
        point: candidate,
        distance: Math.hypot(point.x - candidate.x, point.y - candidate.y)
      }))
      .filter((candidate) => candidate.distance < settings.maxEdge)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    const move = (point) => {
      if (reduceMotion) return;

      point.x += point.vx;
      point.y += point.vy;

      if (point.x < -30 || point.x > width + 30) point.vx *= -1;
      if (point.y < -30 || point.y > height + 30) point.vy *= -1;
    };

    const drawTriangle = (a, b, c, alpha) => {
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.lineTo(c.x, c.y);
      context.closePath();
      context.fillStyle = `rgba(201, 162, 39, ${alpha})`;
      context.fill();
    };

    const drawLine = (a, b, distance, limit, color) => {
      const strength = Math.max(0, 1 - distance / limit);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.strokeStyle = color(strength);
      context.lineCap = "round";
      context.lineWidth = settings.wireBase + strength * settings.wireBoost;
      context.stroke();
    };

    const draw = () => {
      const drawnEdges = new Set();
      const drawnTriangles = new Set();
      context.clearRect(0, 0, width, height);

      points.forEach(move);

      points.forEach((point, index) => {
        const close = nearest(point, 4);

        if (close.length >= 2) {
          const tri = [index, points.indexOf(close[0].point), points.indexOf(close[1].point)].sort((a, b) => a - b).join("-");
          const edgeDistance = Math.hypot(close[0].point.x - close[1].point.x, close[0].point.y - close[1].point.y);
          if (!drawnTriangles.has(tri) && edgeDistance < settings.maxEdge) {
            drawnTriangles.add(tri);
            drawTriangle(point, close[0].point, close[1].point, 0.018 + (1 - edgeDistance / settings.maxEdge) * 0.032);
          }
        }

        close.forEach(({ point: neighbor, distance }) => {
          const neighborIndex = points.indexOf(neighbor);
          const edge = [index, neighborIndex].sort((a, b) => a - b).join("-");
          if (drawnEdges.has(edge)) return;
          drawnEdges.add(edge);
          drawLine(point, neighbor, distance, settings.maxEdge, (alpha) => `rgba(240, 207, 106, ${alpha * 0.32})`);
        });

        if (pointer.active) {
          const pointerDistance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
          if (pointerDistance < settings.pointerEdge) {
            drawLine(point, pointer, pointerDistance, settings.pointerEdge, (alpha) => `rgba(255, 255, 255, ${alpha * 0.28})`);
          }
        }

        context.beginPath();
        context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        context.fillStyle = "rgba(255, 232, 154, 0.74)";
        context.fill();
      });

      if (!reduceMotion && !document.hidden) {
        frame = window.requestAnimationFrame(draw);
      }
    };

    const restart = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
      draw();
    };

    applyLayer();
    resize();
    restart();

    hero.addEventListener("pointermove", (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.active = true;
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    }, { passive: true });

    hero.addEventListener("pointerleave", () => {
      pointer.active = false;
    });

    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
        restart();
      }, 120);
    }, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && frame) {
        window.cancelAnimationFrame(frame);
        frame = null;
        return;
      }

      if (!document.hidden) {
        restart();
      }
    });
  };

  const initHeroWireframe = () => {
    document.querySelectorAll(".wireframe-canvas, #heroWireframeCanvas, #chatbotHeaderCanvas").forEach(initWireframeCanvas);
  };

  // ── Job detail modal ──
  const initJobModal = () => {
    if (!document.querySelector("[data-view-job-card]")) return;

    document.body.insertAdjacentHTML("beforeend", `
      <div class="job-modal" id="jobModal" role="dialog" aria-modal="true" aria-labelledby="jobModalTitle">
        <div class="job-modal__backdrop" data-modal-close></div>
        <div class="job-modal__panel">
          <button class="job-modal__close" type="button" data-modal-close aria-label="Close">&times;</button>
          <div class="job-modal__cover" id="jobModalCover" hidden></div>
          <div class="job-modal__header">
            <div class="job-modal__header-inner">
              <img class="job-modal__logo" id="jobModalLogo" src="" alt="" hidden />
              <div>
                <h2 class="job-modal__title" id="jobModalTitle"></h2>
                <p class="job-modal__company"></p>
              </div>
            </div>
          </div>
          <div class="job-modal__meta"></div>
          <div class="job-modal__body"></div>
          <div class="job-modal__footer">
            <span class="job-modal__closing"><i class="fa-regular fa-calendar-xmark" aria-hidden="true"></i></span>
            <button class="btn btn--dark btn--sm" id="jobModalApply" type="button" data-apply-job>Apply Now <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
          </div>
        </div>
      </div>`);

    const modal      = document.getElementById("jobModal");
    const mTitle     = modal.querySelector(".job-modal__title");
    const mCompany   = modal.querySelector(".job-modal__company");
    const mMeta      = modal.querySelector(".job-modal__meta");
    const mBody      = modal.querySelector(".job-modal__body");
    const mClosing   = modal.querySelector(".job-modal__closing");
    const mCover     = document.getElementById("jobModalCover");
    const mLogo      = document.getElementById("jobModalLogo");
    let   mApply     = document.getElementById("jobModalApply");

    const openModal = (job) => {
      mTitle.textContent   = job.title   || "";
      mCompany.textContent = job.company || "";

      // Cover photo
      if (job.coverPhotoUrl) {
        mCover.style.backgroundImage = `url('${job.coverPhotoUrl}')`;
        mCover.hidden = false;
      } else {
        mCover.style.backgroundImage = "";
        mCover.hidden = true;
      }

      // Company logo
      if (job.companyLogoUrl) {
        mLogo.src = job.companyLogoUrl;
        mLogo.alt = (job.company || "") + " logo";
        mLogo.hidden = false;
      } else {
        mLogo.src = "";
        mLogo.hidden = true;
      }

      const metaFields = [
        { icon: "fa-location-dot",           text: job.location },
        { icon: "fa-briefcase",              text: job.type },
        { icon: "fa-layer-group",            text: job.level },
        { icon: "fa-industry",               text: job.industry },
        { icon: "fa-circle-dollar-to-slot",  text: job.salary ? job.salary + " p.a." : null },
      ].filter((m) => m.text);
      mMeta.innerHTML = metaFields
        .map((m) => `<span class="job-modal__meta-item"><i class="fa-solid ${m.icon}" aria-hidden="true"></i>${m.text}</span>`)
        .join("");

      let bodyHtml = "";

      // About the company
      if (job.companyDescription) {
        bodyHtml += `<div class="job-modal__section"><p class="job-modal__section-title"><i class="fa-solid fa-building" aria-hidden="true"></i> About ${job.company || "the Organisation"}</p><p>${job.companyDescription.replace(/\n/g, "<br>")}</p></div>`;
      }

      // About the role
      const roleText = job.description || job.desc;
      if (roleText) {
        bodyHtml += `<div class="job-modal__section"><p class="job-modal__section-title"><i class="fa-solid fa-briefcase" aria-hidden="true"></i> About the Role</p><p>${roleText.replace(/\n/g, "<br>")}</p></div>`;
      }

      // Key responsibilities
      if (job.responsibilities) {
        const lines = job.responsibilities.split(/\r?\n/).map((s) => s.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
        bodyHtml += `<div class="job-modal__section"><p class="job-modal__section-title"><i class="fa-solid fa-list-check" aria-hidden="true"></i> Key Responsibilities</p><ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul></div>`;
      }

      // Qualifications & experience
      if (job.requirements) {
        const lines = job.requirements.split(/\r?\n/).map((s) => s.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
        bodyHtml += `<div class="job-modal__section"><p class="job-modal__section-title"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i> Qualifications &amp; Experience</p><ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul></div>`;
      }

      // Additional links (social media, website, etc.)
      const externalHref = (url) => {
        const value = String(url || "").trim();
        if (!value) return "";
        if (/^https?:\/\//i.test(value)) return value;
        if (value.startsWith("//")) return `https:${value}`;
        return `https://${value.replace(/^\/+/, "")}`;
      };
      const links = Array.isArray(job.externalLinks) ? job.externalLinks.filter((l) => l?.url) : [];
      if (links.length) {
        bodyHtml += `<div class="job-modal__section job-modal__links"><p class="job-modal__section-title"><i class="fa-solid fa-link" aria-hidden="true"></i> Links</p><div class="job-modal__link-list">${links.map((l) => `<a class="job-modal__link-chip" href="${externalHref(l.url)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>${l.label || l.url}</a>`).join("")}</div></div>`;
      }

      mBody.innerHTML = bodyHtml;

      const closingText = job.closing ? "Closes " + job.closing : "";
      mClosing.innerHTML = `<i class="fa-regular fa-calendar-xmark" aria-hidden="true"></i> ${closingText}`;

      // External career site: swap button → link
      mApply = document.getElementById("jobModalApply");
      if (job.externalApplyUrl) {
        mApply.outerHTML = `<a class="btn btn--dark btn--sm" id="jobModalApply" href="${externalHref(job.externalApplyUrl)}" target="_blank" rel="noopener noreferrer">Apply on Employer Site <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>`;
      } else {
        if (mApply.tagName === "A") {
          mApply.outerHTML = `<button class="btn btn--dark btn--sm" id="jobModalApply" type="button" data-apply-job>Apply Now <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>`;
        }
        document.getElementById("jobModalApply").dataset.jobId = job.id || "";
      }

      modal.classList.add("is-open");
      document.body.style.overflow = "hidden";
      modal.querySelector(".job-modal__panel").scrollTop = 0;
    };

    const closeModal = () => {
      modal.classList.remove("is-open");
      document.body.style.overflow = "";
    };

    modal.addEventListener("click", (e) => {
      if (e.target.closest("[data-modal-close]")) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
    });

    document.querySelectorAll("[data-view-job-card]").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("a") || e.target.closest("[data-apply-job]")) return;
        try { openModal(JSON.parse(card.dataset.job || "{}")); } catch {}
      });
    });

    document.querySelectorAll("[data-view-job]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const card = btn.closest("[data-view-job-card]");
        if (!card) return;
        try { openModal(JSON.parse(card.dataset.job || "{}")); } catch {}
      });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initJobModal);
  } else {
    initJobModal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeroWireframe);
  } else {
    initHeroWireframe();
  }
})();
