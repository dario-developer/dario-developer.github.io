/* ============================================================
   timeline.js · en escritorio/tablet la rueda del ratón mueve la
   línea de tiempo hacia la DERECHA (scroll horizontal).
   En móvil (≤ 576px) no hace nada: la línea es vertical y se baja normal.
   Al llegar a un extremo, la rueda vuelve a mover la página con normalidad.
   ============================================================ */
(function () {
    var MOVIL = window.matchMedia("(max-width: 576px)");

    document.addEventListener("DOMContentLoaded", function () {
        var contenedor = document.querySelector(".timeline-container");
        if (!contenedor) return;

        // El fondo (cielo estrellado de <html>) se desplaza con el contenedor, como si
        // hiciera scroll la página entera: hacia la derecha en escritorio, hacia abajo en móvil.
        var raiz = document.documentElement;
        function moverFondo() {
            raiz.style.setProperty("--fondo-scroll-x", contenedor.scrollLeft + "px");
            raiz.style.setProperty("--fondo-scroll-y", contenedor.scrollTop + "px");
        }
        contenedor.addEventListener("scroll", moverFondo, { passive: true });
        moverFondo();

        window.addEventListener("wheel", function (e) {
            if (MOVIL.matches || e.ctrlKey) return;                 // móvil o zoom: comportamiento normal
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;    // trackpad ya en horizontal: lo deja tal cual

            // deltaMode: 0 = píxeles, 1 = líneas, 2 = páginas
            var delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? contenedor.clientWidth : 1);
            var max = contenedor.scrollWidth - contenedor.clientWidth;
            var puede = delta > 0 ? contenedor.scrollLeft < max - 1 : contenedor.scrollLeft > 0;
            if (!puede) return;                                      // en el extremo: la página baja/sube normal

            e.preventDefault();
            contenedor.scrollLeft += delta;
        }, { passive: false });
    });
})();
