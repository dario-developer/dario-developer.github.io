/* ============================================================
   folio.js · crea las piezas (lados y esquinas) de cada .pf-folio
   No hay que tocar nada: basta con poner la clase "pf-folio" a un elemento.
   Si añades folios dinámicamente (después de cargar la página), llama a:
       pfFolioIniciar();   // o pfFolioIniciar(contenedor)
   ============================================================ */
function pfFolioIniciar(raiz) {
    var lados = ["arriba", "derecha", "abajo", "izquierda"];
    (raiz || document).querySelectorAll(".pf-folio").forEach(function (folio) {
        if (folio.querySelector(":scope > .pf-folio-pieza")) return;   // ya tiene sus piezas
        lados.forEach(function (lado) {
            var pieza = document.createElement("span");
            pieza.className = "pf-folio-pieza pf-folio-" + lado;
            pieza.setAttribute("aria-hidden", "true");
            folio.appendChild(pieza);
        });
    });
}

document.addEventListener("DOMContentLoaded", function () { pfFolioIniciar(); });

/* ============================================================
   Tablón sin arte · si alguna imagen de .pf-board no carga, añade la clase
   "pf-sin-tablon" a <html> y el CSS pinta el tablón de marrón (--tablon-respaldo).
   ============================================================ */
function pfTablonComprobar() {
    var tablon = document.querySelector(".pf-board");
    if (!tablon) return;
    var estilo = getComputedStyle(tablon);
    var texto = estilo.backgroundImage + " " + estilo.borderImageSource;
    var urls = [];
    texto.replace(/url\(["']?([^"')]+)["']?\)/g, function (_, u) { urls.push(u); });

    function sinArte() { document.documentElement.classList.add("pf-sin-tablon"); }
    if (!urls.length) { sinArte(); return; }
    urls.forEach(function (u) {
        var img = new Image();
        img.onerror = sinArte;
        img.src = u;
    });
}

document.addEventListener("DOMContentLoaded", pfTablonComprobar);

/* ============================================================
   Proyectos · guarda el alto del tablón más alto en --proyecto-alto-tablon
   (el CSS lo usa para que la separación sea la mitad de ese alto, en todos los tamaños).
   Se recalcula solo al cargar imágenes o cambiar el tamaño de la pantalla.
   ============================================================ */
function pfProyectosIniciar() {
    var lista = document.querySelector(".pf-proyectos");
    if (!lista) return;
    var tablones = lista.querySelectorAll(".pf-proyecto-tablon");

    function medir() {
        var alto = 0;
        tablones.forEach(function (t) { alto = Math.max(alto, t.offsetHeight); });
        lista.style.setProperty("--proyecto-alto-tablon", alto + "px");
    }

    if ("ResizeObserver" in window) {
        var observador = new ResizeObserver(medir);
        tablones.forEach(function (t) { observador.observe(t); });
    } else {
        window.addEventListener("resize", medir);
        window.addEventListener("load", medir);
    }
    medir();
}

document.addEventListener("DOMContentLoaded", pfProyectosIniciar);