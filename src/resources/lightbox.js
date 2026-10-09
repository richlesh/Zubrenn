<script>
	(function () {
	  // Build the overlay element once and append it to the body. It is reused
	  // for every image on the page.
	  let lightbox = null;
	  let lightboxImg = null;
	
	  function buildLightbox() {
		lightbox = document.createElement("div");
		lightbox.id = "lightbox";
		lightboxImg = document.createElement("img");
		lightboxImg.setAttribute("alt", "");
		lightbox.appendChild(lightboxImg);
		document.body.appendChild(lightbox);
		lightbox.addEventListener("click", closeLightbox);
	  }
	
	  function openLightbox(src) {
		if (!lightbox || !lightboxImg) return;
		lightboxImg.src = src;
		lightbox.classList.add("open");
	  }
	
	  function closeLightbox() {
		if (!lightbox) return;
		lightbox.classList.remove("open");
		if (lightboxImg) lightboxImg.removeAttribute("src");
	  }
	
	  // A single delegated click handler on the body enlarges any image —
	  // including images added to the page after load.
	  function wireImages() {
		document.body.addEventListener("click", function (e) {
		  const img = e.target.closest("img");
		  // Ignore clicks on the overlay's own image.
		  if (!img || img === lightboxImg) return;
		  e.preventDefault();
		  e.stopPropagation();
		  openLightbox(img.getAttribute("src"));
		});
	  }
	
	  // Esc closes an open lightbox.
	  function wireKeyboard() {
		document.addEventListener("keydown", function (e) {
		  if (e.key === "Escape" && lightbox && lightbox.classList.contains("open")) {
			closeLightbox();
		  }
		});
	  }
	
	  function init() {
		buildLightbox();
		wireImages();
		wireKeyboard();
	  }
	
	  if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	  } else {
		init();
	  }
	})();
</script>
