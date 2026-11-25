const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzaNMSIdWxIAJbLx9TyrOvk03Vu9EiW_bUrZxfMF6rP1PhL3ElRG3eXrhDfTajoBmBW/exec";

const OTHER_TOWN = "other";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

initBackgroundMusic(document.getElementById("bg-music"), document.getElementById("music-toggle"));
initSeamlessVideo(document.querySelectorAll(".bg-video"));
initSnowfall(document.querySelector(".snowfall"));
initScrollCue(document.querySelector(".scroll-cue"));
initRegistrationForm(document.getElementById("registration"));

function initBackgroundMusic(audio, toggle) {
  if (!audio || !toggle) return;

  const mutedKey = "music-muted";
  const volume = 0.35;
  const gestureEvents = ["click", "keydown", "touchend"];
  let wanted = false;
  let fadeFrame = 0;

  const label = toggle.querySelector(".music-label");

  function render(playing) {
    const text = playing ? "Pause music" : "Play music";
    toggle.classList.toggle("is-playing", playing);
    toggle.setAttribute("aria-pressed", String(playing));
    toggle.setAttribute("aria-label", text);
    if (label) label.textContent = text;
  }

  function fadeTo(target, onDone) {
    cancelAnimationFrame(fadeFrame);
    const from = audio.volume;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / 1200, 1);
      audio.volume = from + (target - from) * progress;
      if (progress < 1) fadeFrame = requestAnimationFrame(step);
      else onDone?.();
    };
    fadeFrame = requestAnimationFrame(step);
  }

  async function play() {
    wanted = true;
    audio.volume = 0;
    try {
      await audio.play();
    } catch {
      wanted = false;
      render(false);
      return false;
    }
    render(true);
    fadeTo(volume);
    return true;
  }

  function pause() {
    wanted = false;
    render(false);
    fadeTo(0, () => audio.pause());
  }

  function stopWaitingForGesture() {
    gestureEvents.forEach((type) => document.removeEventListener(type, startOnGesture));
  }

  function startOnGesture(event) {
    if (toggle.contains(event.target)) return;
    stopWaitingForGesture();
    play();
  }

  toggle.addEventListener("click", () => {
    stopWaitingForGesture();
    if (wanted) {
      localStorage.setItem(mutedKey, "1");
      pause();
    } else {
      localStorage.removeItem(mutedKey);
      play();
    }
  });

  audio.addEventListener("error", () => {
    stopWaitingForGesture();
    toggle.hidden = true;
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) audio.pause();
    else if (wanted) audio.play().catch(() => {});
  });

  if (localStorage.getItem(mutedKey)) return;

  play().then((started) => {
    if (!started && !toggle.hidden) gestureEvents.forEach((type) => document.addEventListener(type, startOnGesture));
  });
}

function initSeamlessVideo(videoList) {
  const videos = [...videoList];
  if (videos.length !== 2) return;

  if (prefersReducedMotion) {
    videos.forEach((video) => video.pause());
    return;
  }

  const fadeSeconds = 0.6;
  let active = 0;
  let swapping = false;

  async function swap() {
    if (swapping) return;
    swapping = true;

    const current = videos[active];
    const next = videos[1 - active];
    next.currentTime = 0;

    try {
      await next.play();
    } catch {
      swapping = false;
      return;
    }

    next.classList.add("is-active", "is-front");
    current.classList.remove("is-front");
    active = 1 - active;

    setTimeout(() => {
      current.classList.remove("is-active");
      current.pause();
      current.currentTime = 0;
      swapping = false;
    }, fadeSeconds * 1000 + 100);
  }

  function tick() {
    const { duration, currentTime } = videos[active];
    if (duration && duration - currentTime <= fadeSeconds) swap();
    requestAnimationFrame(tick);
  }

  videos.forEach((video) => video.addEventListener("ended", swap));
  videos[0].play().catch(() => {});
  requestAnimationFrame(tick);
}

function initSnowfall(canvas) {
  if (!canvas || prefersReducedMotion) return;

  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let flakes = [];
  let visible = false;

  const createFlake = (y = -5) => ({
    x: Math.random() * width,
    y,
    radius: 0.8 + Math.random() * 2.2,
    speed: 0.3 + Math.random() * 0.8,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.35 + Math.random() * 0.5,
  });

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#fff";

    const count = Math.round(Math.min(110, (width * height) / 9000));
    flakes = Array.from({ length: count }, () => createFlake(Math.random() * height));
  }

  function draw() {
    if (!visible) return;
    ctx.clearRect(0, 0, width, height);

    for (const flake of flakes) {
      flake.y += flake.speed;
      flake.phase += 0.01;
      flake.x += Math.sin(flake.phase) * 0.35;
      if (flake.y > height + 5) Object.assign(flake, createFlake());

      ctx.globalAlpha = flake.alpha;
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {
    const wasVisible = visible;
    visible = entry.isIntersecting;
    if (visible && !wasVisible) requestAnimationFrame(draw);
  }).observe(canvas);
}

function initScrollCue(link) {
  if (!link) return;
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
  });
}

function initRegistrationForm(form) {
  const confirmation = document.getElementById("confirmation");
  const message = document.getElementById("form-message");
  const submitButton = form.querySelector('[type="submit"]');
  const otherTownField = document.getElementById("other-town-field");
  const otherTownInput = form.elements.otherTown;

  const townSelect = createTownSelect(form.querySelector(".dropdown"), (town) => {
    setError(townSelect.trigger);
    toggleOtherTown(town);
    if (town === OTHER_TOWN) otherTownInput.focus();
  });

  const fieldFor = (name) => (name === "town" ? townSelect.trigger : form.elements[name]);

  function toggleOtherTown(town) {
    const isOther = town === OTHER_TOWN;
    otherTownField.hidden = !isOther;
    otherTownInput.required = isOther;
  }

  function setError(field, text = "") {
    document.getElementById(field.getAttribute("aria-describedby")).textContent = text;
    if (text) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  }

  function showMessage(text = "") {
    message.textContent = text;
    message.hidden = !text;
  }

  function setSubmitting(isSubmitting) {
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "Registering…" : "Register";
  }

  function readForm() {
    const value = (name) => form.elements[name].value.trim();
    return {
      name: value("name"),
      phone: toLatinDigits(value("phone")),
      age: toLatinDigits(value("age")),
      town: townSelect.value,
      otherTown: value("otherTown"),
      email: value("email"),
    };
  }

  function resetForm() {
    form.reset();
    townSelect.setValue("");
    toggleOtherTown("");
  }

  form.addEventListener("input", (event) => {
    if (event.target.hasAttribute("aria-describedby")) setError(event.target);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitButton.disabled) return;

    const data = readForm();
    const errors = validate(data);
    for (const name of Object.keys(data)) setError(fieldFor(name), errors[name]);

    const [firstInvalid] = Object.keys(errors);
    if (firstInvalid) {
      showMessage("Check your details and try again.");
      fieldFor(firstInvalid).focus();
      return;
    }

    showMessage();
    setSubmitting(true);

    try {
      await saveRegistration({
        name: data.name,
        phone: data.phone,
        age: data.age,
        town: data.town === OTHER_TOWN ? data.otherTown : data.town,
        email: data.email,
      });
      resetForm();
      form.hidden = true;
      confirmation.hidden = false;
      confirmation.querySelector("h2").focus();
    } catch (error) {
      console.error(error);
      showMessage("We couldn’t save your registration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  });

  document.getElementById("register-another").addEventListener("click", () => {
    confirmation.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });
}

function createTownSelect(root, onSelect) {
  const input = root.querySelector('input[type="hidden"]');
  const trigger = root.querySelector(".dropdown-trigger");
  const label = trigger.querySelector(".dropdown-value");
  const menu = root.querySelector(".dropdown-menu");
  const options = [...menu.querySelectorAll('[role="option"]')];
  const placeholder = label.textContent;
  let activeIndex = -1;

  options.forEach((option, index) => {
    option.id = `${menu.id}-option-${index}`;
    option.dataset.value ??= option.textContent.trim();
    option.setAttribute("aria-selected", "false");
    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("mousemove", () => highlight(index, { scroll: false }));
    option.addEventListener("click", () => select(index));
  });

  function highlight(index, { scroll = true } = {}) {
    activeIndex = index;
    options.forEach((option, i) => option.classList.toggle("is-active", i === index));
    menu.setAttribute("aria-activedescendant", options[index].id);
    if (scroll) options[index].scrollIntoView({ block: "nearest" });
  }

  function open() {
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    highlight(Math.max(options.findIndex((option) => option.dataset.value === input.value), 0));
    menu.focus({ preventScroll: true });
    menu.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function close({ restoreFocus = true } = {}) {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  function setValue(value) {
    const selected = options.find((option) => option.dataset.value === value);
    input.value = selected ? value : "";
    options.forEach((option) => option.setAttribute("aria-selected", String(option === selected)));
    label.textContent = selected ? selected.textContent.trim() : placeholder;
    label.dir = selected?.dir || "auto";
    trigger.classList.toggle("is-placeholder", !selected);
  }

  function select(index) {
    setValue(options[index].dataset.value);
    close();
    onSelect(input.value);
  }

  const menuKeys = {
    ArrowDown: () => highlight(Math.min(activeIndex + 1, options.length - 1)),
    ArrowUp: () => highlight(Math.max(activeIndex - 1, 0)),
    Home: () => highlight(0),
    End: () => highlight(options.length - 1),
    Enter: () => select(activeIndex),
    " ": () => select(activeIndex),
    Escape: () => close(),
  };

  trigger.addEventListener("mousedown", (event) => {
    if (!menu.hidden) event.preventDefault();
  });

  trigger.addEventListener("click", () => (menu.hidden ? open() : close()));

  trigger.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    open();
  });

  menu.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      close({ restoreFocus: false });
      return;
    }
    const action = menuKeys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  });

  menu.addEventListener("blur", () => close({ restoreFocus: false }));

  document.addEventListener("pointerdown", (event) => {
    if (!menu.hidden && !root.contains(event.target)) close({ restoreFocus: false });
  });

  return {
    trigger,
    get value() {
      return input.value;
    },
    setValue,
  };
}

function validate({ name, phone, age, town, otherTown, email }) {
  const errors = {};
  const phoneDigits = phone.replace(/\D/g, "").replace(/^00/, "");

  if (!name) errors.name = "Enter your name.";
  if (!/^\+?[\d ().-]+$/.test(phone) || phoneDigits.length < 6 || phoneDigits.length > 15) {
    errors.phone = "Enter a valid phone number.";
  }
  if (!/^\d{1,3}$/.test(age)) errors.age = "Enter your age in whole years.";
  if (!town) errors.town = "Choose a town from the list.";
  if (town === OTHER_TOWN && !otherTown) errors.otherTown = "Enter your town name.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";

  return errors;
}

function toLatinDigits(value) {
  return value
    .replace(/[٠-٩]/g, (digit) => digit.charCodeAt(0) - 0x0660)
    .replace(/[۰-۹]/g, (digit) => digit.charCodeAt(0) - 0x06f0);
}

async function saveRegistration(registration) {
  if (!GOOGLE_SHEET_URL) {
    console.warn("GOOGLE_SHEET_URL is not set; registration was not saved.", registration);
    return;
  }

  const response = await fetch(GOOGLE_SHEET_URL, {
    method: "POST",
    body: new URLSearchParams(registration),
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.error ?? "Registration was not saved.");
}
