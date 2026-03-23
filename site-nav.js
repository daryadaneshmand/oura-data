(function () {
  const LINKS = [
    { href: "fingerprint.html", label: "Sleep Fingerprint", key: "fingerprint" },
    { href: "couples.html", label: "Couples Sleep", key: "couples" },
  ];

  const root = document.getElementById("site-nav");
  if (!root) return;

  const active = document.body.dataset.nav || "";
  const frag = document.createDocumentFragment();
  for (const { href, label, key } of LINKS) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    if (key === active) a.classList.add("active");
    frag.appendChild(a);
  }
  root.appendChild(frag);
})();
