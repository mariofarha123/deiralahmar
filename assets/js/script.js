const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxF8nNoZauOWtnooj1dGDxrmJ5WO4-sX4SWfxARQKkN8IOptAWBLlp60cVPfCHF3in9/exec";

const OTHER_TOWN = "other";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (performance.getEntriesByType("navigation")[0]?.type === "reload") {
  document.addEventListener("DOMContentLoaded", () => {
    // Resolve the page layout before resetting a restored scroll position.
    const { top, left } = document.documentElement.getBoundingClientRect();
    if (top || left) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    initPage();
  }, { once: true });
} else {
  initPage();
}

function initPage() {
  const warmStandbyVideo = initSeamlessVideo(document.querySelectorAll(".bg-video"));
  initSnowfall(document.querySelector(".snowfall-flakes"));
  const blizzardTargets = initBlizzard(document.querySelector(".blizzard-intro"), () => warmStandbyVideo?.());
  initRegistrationForm(document.getElementById("registration"));
  if (!blizzardTargets) warmStandbyVideo?.();
  initScrollCue(document.querySelector(".scroll-cue"));
  initViewportReveals(blizzardTargets);
}

function initBlizzard(intro, onClear) {
  if (!intro || prefersReducedMotion || document.hidden) return;
  const whiteout = intro.querySelector(".blizzard-whiteout");
  const ctx = whiteout.getContext("2d");
  if (!ctx) return;

  const duration = 3500;
  const clearStart = 0.15;
  const clearEnd = 0.87;
  const fogOrigin = -0.84;
  const windTravel = 2.02;
  const minHeroFade = 320;
  const heroActions = document.querySelector(".hero-actions");

  const targets = [...document.querySelectorAll(".hero-logo, .register-logo, .register > .card, .register .form-actions > .button")]
    .filter((element) => {
      const { width, bottom, top } = element.getBoundingClientRect();
      return width > 0 && bottom > 0 && top < window.innerHeight;
    });

  const [fineSnow, closeSnow] = intro.querySelectorAll(".blizzard-flakes");
  paintSnowTile(fineSnow, 420, 112, 25, 4);
  paintSnowTile(closeSnow, 480, 132, 0, 8);
  intro.style.setProperty("--blizzard-length", `${duration}ms`);
  intro.style.setProperty("--blizzard-sweep-delay", `${duration * clearStart}ms`);
  intro.style.setProperty("--blizzard-sweep-length", `${duration * (clearEnd - clearStart)}ms`);

  function prepareFog() {
    const { width, height, left, top } = intro.getBoundingClientRect();
    const fogWidth = width * 0.74;
    const fogHeight = height * 0.16;
    const fogY = height * 0.45;
    const fogLengthSquared = Math.max(1, fogWidth ** 2 + fogHeight ** 2);
    // Keep the sheet's left boundary outside the soft fog, even on tall screens.
    const fogX = ((height - fogY) * fogHeight + 0.5 * fogLengthSquared) / Math.max(1, fogWidth);
    const sheetPixels = width * (1 - fogOrigin) + fogX;
    // Keep the painted sheet and its sweep proportional to the viewport during toolbar changes.
    intro.style.setProperty("--blizzard-sheet-width", `${100 * sheetPixels / width}%`);
    intro.style.setProperty("--blizzard-travel", `${100 * width * windTravel / sheetPixels}%`);
    const ratio = Math.min(0.35, 420 / Math.max(1, sheetPixels), 295 / Math.max(1, height));
    whiteout.width = Math.max(1, Math.round(sheetPixels * ratio));
    whiteout.height = Math.max(1, Math.round(height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const texture = paintFogBank(ctx, { sheetPixels, height, fogX, fogY, fogWidth, fogHeight, fogLengthSquared });

    // Bake the soft gusts into the whiteout so they share a single moving layer.
    for (let i = 0; i < 12; i++) {
      const x = fogX + width * (0.18 + (i % 4) * 0.36 + Math.random() * 0.17);
      const y = height * (i + Math.random()) / 12;
      const radius = Math.min(width * (0.065 + Math.random() * 0.045), height * 0.12);
      if (radius <= 0) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.13);
      ctx.scale(3.8, 1);
      const puff = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      puff.addColorStop(0, "rgba(255, 255, 255, 0.52)");
      puff.addColorStop(0.4, "rgba(250, 251, 252, 0.24)");
      puff.addColorStop(1, "rgba(246, 247, 249, 0)");
      ctx.fillStyle = puff;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }

    // Use the middle of the fog front to time each reveal.
    const fogTravel = Math.max(1, width * windTravel * fogWidth);
    let formRevealStart = 0;
    for (const target of targets) {
      const bounds = target.getBoundingClientRect();
      const x = bounds.left + bounds.width / 2 - left - width * fogOrigin;
      const y = bounds.top + bounds.height / 2 - top - fogY;
      const projection = x * fogWidth + y * fogHeight;
      const reaches = sweepTime((projection - 0.87 * fogLengthSquared) / fogTravel);
      const ends = sweepTime((projection - 0.05 * fogLengthSquared) / fogTravel);
      if (target.matches(".card")) formRevealStart = reaches;
      const begins = target.matches(".button") ? Math.max(reaches, formRevealStart + 100) : reaches;
      target.style.setProperty("--blizzard-delay", `${begins}ms`);
      target.style.setProperty("--blizzard-duration", `${Math.min(ends - reaches, duration - begins)}ms`);
    }
    return { texture, sheetWidthRatio: sheetPixels / width };
  }

  function sweepTime(amount) {
    // Invert smoothstep to convert a position on the sweep into elapsed time.
    const clamped = Math.max(0, Math.min(1, amount));
    const phase = 0.5 - Math.sin(Math.asin(1 - 2 * clamped) / 3);
    return duration * (clearStart + (clearEnd - clearStart) * phase);
  }

  function syncHeroReveals() {
    const { width, height, right, top } = intro.getBoundingClientRect();
    if (!width || !height) return;
    const { width: columns, height: rows, data } = fog.texture;
    const sheetWidth = width * fog.sheetWidthRatio;
    const sheetLeft = right - sheetWidth;
    const scale = columns / sheetWidth;
    const travel = width * windTravel * scale;

    for (const animation of heroReveals) {
      const effect = animation.effect;
      const elapsed = animation.currentTime ?? 0;
      // Retiming a fade that has already started would jump its opacity.
      if (elapsed >= effect.getTiming().delay) continue;
      const bounds = effect.target.getBoundingClientRect();
      if (!bounds.width || bounds.bottom <= 0) continue;

      const centerY = bounds.top + bounds.height / 2;
      const row = Math.max(0, Math.min(rows - 1, Math.floor((centerY - top) * rows / height)));
      const points = [0.25, 0.5, 0.75].map((fraction) => (bounds.left + bounds.width * fraction - sheetLeft) * scale);
      let begin;
      let end = duration;

      // Sample the painted fog over the button as the sheet moves past it.
      for (let step = 0; step <= 64; step++) {
        const progress = step / 64;
        const alpha = points.reduce((sum, point) => {
          const column = Math.floor(point - progress * travel);
          if (column < 0 || column >= columns) return sum;
          return sum + data[(row * columns + column) * 4 + 3];
        }, 0) / (255 * points.length);
        if (alpha <= 0.32) begin ??= sweepTime(progress);
        if (alpha <= 0.07) {
          end = sweepTime(progress);
          break;
        }
      }

      const delay = Math.min(duration - minHeroFade, Math.max(elapsed, begin ?? sweepTime(1)));
      effect.updateTiming({ delay, duration: Math.max(minHeroFade, end - delay) });
    }
  }

  function finish() {
    clearTimeout(deadline);
    revealResize.disconnect();
    window.removeEventListener("scroll", syncHeroReveals);
    window.removeEventListener("pagehide", finish);
    document.removeEventListener("focusin", finish);
    whiteout.removeEventListener("animationend", finishOnFade);
    if (heroActions.matches(".is-in-view, :focus-within")) heroActions.classList.add("blizzard-presented");
    for (const animation of heroReveals) animation.cancel();
    for (const target of targets) {
      target.classList.remove("blizzard-emerge");
      target.style.removeProperty("--blizzard-delay");
      target.style.removeProperty("--blizzard-duration");
    }
    intro.remove();
    onClear();
  }

  function finishOnFade(event) {
    if (event.animationName === "blizzard-veil-fade") finish();
  }

  intro.hidden = false;
  const fog = prepareFog();
  const heroReveals = [...heroActions.querySelectorAll(":scope > a")].map((link) => link.animate(
    [{ opacity: 0, pointerEvents: "none" }, { opacity: 1, pointerEvents: "auto" }],
    { duration: minHeroFade, delay: duration, easing: "cubic-bezier(0.37, 0, 0.24, 1)", fill: "both" },
  ));
  syncHeroReveals();
  const revealResize = new ResizeObserver(syncHeroReveals);
  revealResize.observe(intro);
  revealResize.observe(heroActions.parentElement);
  revealResize.observe(heroActions);
  for (const target of targets) target.classList.add("blizzard-emerge");
  intro.classList.add("is-playing");
  const deadline = setTimeout(finish, duration + 1200);
  whiteout.addEventListener("animationend", finishOnFade);
  window.addEventListener("scroll", syncHeroReveals, { passive: true });
  window.addEventListener("pagehide", finish, { once: true });
  document.addEventListener("focusin", finish, { once: true });
  return targets;
}

function paintFogBank(ctx, { sheetPixels, height, fogX, fogY, fogWidth, fogHeight, fogLengthSquared }) {
  const { width, height: rows } = ctx.canvas;
  const image = ctx.createImageData(width, rows);
  const pixels = image.data;
  const contours = [-0.11, 0.16, 0.23, -0.13, -0.21, 0.08, 0.19, -0.04, -0.16, 0.11, 0.18, -0.06];
  const xProjection = Float32Array.from({ length: width }, (_, x) =>
    ((x + 0.5) * sheetPixels / width - fogX) * fogWidth / fogLengthSquared,
  );

  for (let y = 0; y < rows; y++) {
    const vertical = (y + 0.5) / rows;
    const position = vertical * (contours.length - 1);
    const section = Math.floor(position);
    const fraction = position - section;
    const eased = fraction * fraction * (3 - 2 * fraction);
    const bank = contours[section] + (contours[section + 1] - contours[section]) * eased;
    const yProjection = (vertical * height - fogY) * fogHeight / fogLengthSquared + bank;
    const softness = 0.9 + 0.17 * Math.sin(vertical * 18 + 0.6);

    for (let x = 0; x < width; x++) {
      const horizontal = x / width;
      const ripples = 0.085 * Math.sin(horizontal * 25 + vertical * 20)
        + 0.041 * Math.sin(horizontal * 59 - vertical * 43);
      const density = (xProjection[x] + yProjection + ripples - 0.5) / softness + 0.5;
      const cover = Math.max(0, Math.min(1, density));
      const tone = 250 - cover * 11;
      const pixel = (y * width + x) * 4;
      pixels[pixel] = tone;
      pixels[pixel + 1] = tone + 1;
      pixels[pixel + 2] = tone + 2;
      pixels[pixel + 3] = 240 * cover * cover * (3 - 2 * cover);
    }
  }
  ctx.putImageData(image, 0, 0);
  return image;
}

function paintSnowTile(layer, width, height, fineCount, closeCount, windDriven = true) {
  const tile = document.createElement("canvas");
  tile.width = width;
  tile.height = height;
  const ctx = tile.getContext("2d");
  if (!ctx) return;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";

  for (let i = 0; i < fineCount + closeCount; i++) {
    const close = i >= fineCount;
    const margin = close ? 16 : 12;
    const x = margin + Math.random() * (width - 2 * margin);
    const y = margin + Math.random() * (height - 2 * margin);
    ctx.globalAlpha = 0.25 + Math.random() * 0.58;
    if (close) {
      const radius = 2.2 + Math.random() * 5.5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.27);
      ctx.scale(1.85, 1);
      const blur = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      blur.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      blur.addColorStop(0.38, "rgba(251, 252, 253, 0.5)");
      blur.addColorStop(1, "rgba(246, 247, 248, 0)");
      ctx.fillStyle = blur;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    } else if (windDriven) {
      const length = 1 + Math.random() * 8;
      ctx.lineWidth = 0.55 + Math.random() * 1.05;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + length, y + length * 0.25);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 0.75 + Math.random() * 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  layer.style.setProperty("--snow-width", `${width}px`);
  layer.style.setProperty("--snow-height", `${height}px`);
  layer.style.backgroundImage = `url("${tile.toDataURL()}")`;
}

function initSeamlessVideo(videoList) {
  const videos = [...videoList];
  if (videos.length !== 2) return;

  if (prefersReducedMotion) {
    videos.forEach((video) => video.pause());
    return;
  }

  const [firstVideo, standbyVideo] = videos;
  function showFirstVideo() {
    firstVideo.classList.add("is-active");
  }

  if (!firstVideo.paused && firstVideo.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    showFirstVideo();
  } else {
    firstVideo.addEventListener("playing", showFirstVideo, { once: true });
  }

  const fadeSeconds = 0.6;
  let active = 0;
  let swapping = false;
  let onScreen = true;

  async function swap() {
    if (swapping || !onScreen) return;
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

  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) videos[active].play().catch(() => {});
    else videos.forEach((video) => video.pause());
  }).observe(videos[0].parentElement);

  videos.forEach((video) => video.addEventListener("ended", swap));
  videos[0].play().catch(() => {});
  requestAnimationFrame(tick);

  return () => {
    // Give the visible clip the startup buffer before fetching the next loop.
    function preloadStandby() {
      if (!firstVideo.duration || firstVideo.currentTime < Math.min(4, firstVideo.duration / 2)) return;
      firstVideo.removeEventListener("timeupdate", preloadStandby);
      standbyVideo.preload = "auto";
      standbyVideo.load();
    }

    firstVideo.addEventListener("timeupdate", preloadStandby);
    preloadStandby();
  };
}

function initSnowfall(layer) {
  if (!layer || prefersReducedMotion) return;
  paintSnowTile(layer, 340, 210, 10, 0, false);
  layer.classList.add("is-snowing");
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

function initViewportReveals(blizzardTargets = []) {
  if (prefersReducedMotion || !window.IntersectionObserver) return;

  const enter = new IntersectionObserver((entries) => {
    let delay = 0;
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting || target.classList.contains("is-in-view")) continue;
      if (target.closest("#registration")) {
        target.style.setProperty("--reveal-delay", `${delay}ms`);
        delay = Math.min(delay + 45, 180);
      }
      target.classList.add("is-in-view");
    }
  }, { rootMargin: "24px 0px" });

  // Reset farther offscreen so the pop's movement can't restart its own reveal.
  const exit = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) target.classList.remove("is-in-view", "blizzard-presented");
    }
  }, { rootMargin: "64px 0px" });

  const heroActions = document.querySelector(".hero-actions");
  heroActions.classList.add("reveal");
  // Let the buttons replay when they return from the top edge above the form.
  new IntersectionObserver(([{ isIntersecting }]) => {
    heroActions.classList.toggle("is-in-view", isIntersecting);
    if (!isIntersecting) heroActions.classList.remove("blizzard-presented");
  }, { rootMargin: "-64px 0px 24px" }).observe(heroActions);

  const elements = document.querySelectorAll(
    ".hero-logo, .card, #registration > :is(.card-header, .field, .row, .form-actions)",
  );
  for (const element of elements) {
    element.classList.add("reveal");
    if (blizzardTargets.some((target) => target.contains(element))) {
      element.classList.add("is-in-view", "blizzard-presented");
    }
    enter.observe(element);
    exit.observe(element);
  }
}

function initRegistrationForm(form) {
  const confirmation = document.getElementById("confirmation");
  const section = form.closest("#register");
  const hero = document.querySelector(".hero");
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

  function showConfirmation() {
    if (!confirmation.hidden) return;

    form.reset();
    townSelect.setValue("");
    toggleOtherTown("");
    form.hidden = true;
    confirmation.hidden = false;
    hero.hidden = true;
    section.scrollTop = 0;
    section.scrollIntoView({ behavior: "instant" });
    confirmation.querySelector("h2").focus({ preventScroll: true });
  }

  form.addEventListener("input", (event) => {
    if (event.target.hasAttribute("aria-describedby")) setError(event.target);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!confirmation.hidden || submitButton.disabled) return;

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
      const registration = {
        name: data.name,
        phone: data.phone,
        age: data.age,
        town: data.town === OTHER_TOWN ? data.otherTown : data.town,
        email: data.email,
      };

      await saveRegistration(registration);
      showConfirmation();
    } catch (error) {
      if (error.code === "DUPLICATE_PHONE" || error.code === "INVALID_PHONE") {
        setError(form.elements.phone, error.message);
        form.elements.phone.focus();
        return;
      }
      console.error(error);
      showMessage("We couldn’t save your registration. Please try again.");
    } finally {
      setSubmitting(false);
    }
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
  if (!phone) {
    errors.phone = "Enter your phone number.";
  } else if (!/^\+?[\d ().-]+$/.test(phone) || phoneDigits.length < 6 || phoneDigits.length > 15) {
    errors.phone = "Enter a valid phone number.";
  }
  if (!age) errors.age = "Enter your age.";
  else if (!/^\d{1,3}$/.test(age)) errors.age = "Enter your age in whole years.";
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
    throw new Error("Registration endpoint is not configured.");
  }

  const response = await fetch(GOOGLE_SHEET_URL, {
    method: "POST",
    body: new URLSearchParams(registration),
  });
  const result = await response.json();
  if (!result.ok) {
    const error = new Error(result.error ?? "Registration was not saved.");
    error.code = result.code;
    throw error;
  }
}
