/* ============================================================
   folio.js · crea las piezas (lados y esquinas) de cada .pf-folio
   No hay que tocar nada: basta con poner la clase "pf-folio" a un elemento.
   Si añades folios dinámicamente (después de cargar la página), llama a:
       pfFolioIniciar();   // o pfFolioIniciar(contenedor)
   ============================================================ */
function pfFolioIniciar(raiz) {
    var lados = ["arriba", "derecha", "abajo", "izquierda"];
    raiz = raiz || document;

    // 1. Una <img> o <video> no puede tener piezas dentro: se envuelve en un <span> que se queda la clase
    raiz.querySelectorAll("img.pf-folio, img.pf-marco, video.pf-folio, video.pf-marco").forEach(function (img) {
        var envoltorio = document.createElement("span");
        envoltorio.className = "pf-envoltorio pf-folio" + (img.classList.contains("pf-marco") ? " pf-marco" : "");
        img.classList.remove("pf-folio", "pf-marco");
        img.parentNode.insertBefore(envoltorio, img);
        envoltorio.appendChild(img);
    });

    // 2. .pf-marco (fotos) y .pf-cartel (cabeceras) = folio con otras hojas: usan el mismo motor
    raiz.querySelectorAll(".pf-marco, .pf-cartel").forEach(function (el) { el.classList.add("pf-folio"); });

    // 3. Crea las piezas (lados y esquinas) de cada folio
    raiz.querySelectorAll(".pf-folio").forEach(function (folio) {
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
   Igualar alto (.pf-igualar-alto) · las imágenes de la columna intentan sumar
   el mismo alto que la columna vecina, SIN perder la escala:
       alto = clamp(mínimo, objetivo, máximo)
   mínimo/máximo = altos con los que se recorta como mucho --igualar-recorte-max
   de la imagen (desde el centro). Solo cuando las columnas están lado a lado.
   ============================================================ */
function pfIgualarAltos() {
    var raizCss = getComputedStyle(document.documentElement);
    var recorte = parseFloat(raizCss.getPropertyValue("--igualar-recorte-max")) || 0.1;
    var anchoMaxDefecto = parseFloat(raizCss.getPropertyValue("--igualar-ancho-max")) || 0.6;
    var k = 1 - recorte;   // proporción que se conserva como mínimo

    function altoContenido(col) {
        var hijos = col.children;
        return hijos[hijos.length - 1].getBoundingClientRect().bottom - hijos[0].getBoundingClientRect().top;
    }

    function restaurar(imgs) {   // vuelve a la proporción natural
        imgs.forEach(function (img) {
            img.style.height = img.style.width = "";
            var env = img.closest(".pf-envoltorio");
            if (env) env.style.width = "";
        });
    }

    document.querySelectorAll(".pf-igualar-alto").forEach(function (col) {
        var imgs = Array.prototype.slice.call(col.querySelectorAll("img"));
        restaurar(imgs);
        col.classList.remove("pf-lado-a-lado");
        col.style.width = col.style.maxWidth = "";

        var vecina = col.previousElementSibling || col.nextElementSibling;
        if (!vecina || !imgs.length) return;

        // ¿Están en la misma fila? (si se apilan, empiezan a la misma altura de x)
        var ladoALado = Math.abs(col.getBoundingClientRect().left - vecina.getBoundingClientRect().left) > 1;
        if (!ladoALado) return;
        if (imgs.some(function (img) { return !img.naturalWidth; })) return;   // falta alguna por cargar
        col.classList.add("pf-lado-a-lado");

        function probarAncho(px) {   // pone la columna a ese ancho, ajusta imágenes y devuelve (columna - texto)
            if (px !== null) { col.style.width = px + "px"; col.style.maxWidth = "none"; }
            ajustar();
            return altoContenido(col) - vecina.getBoundingClientRect().height;
        }

        // Si con su ancho de clase las imágenes no llegan al alto del texto (aun recortando el máximo),
        // se prueba a ENSANCHAR la columna (el texto se estrecha y crece) hasta el tope:
        //   · si algún ancho encaja → el más estrecho que encaja (bisección)
        //   · si ninguno encaja     → el que deja la MENOR diferencia
        var base = col.getBoundingClientRect().width;
        var anchoMaxFila = parseFloat(getComputedStyle(col).getPropertyValue("--igualar-ancho-max")) || anchoMaxDefecto;   // se puede poner distinto en cada columna
        var tope = Math.max(base, col.parentElement.getBoundingClientRect().width * anchoMaxFila);
        var difBase = probarAncho(null);
        if (difBase < -1 && tope > base + 1) {
            var pasos = 8, mejor = { ancho: null, dif: difBase }, previo = base, encaja = null;
            for (var p = 1; p <= pasos; p++) {
                var w = base + (tope - base) * p / pasos;
                var d = probarAncho(w);
                if (d >= -1) { encaja = [previo, w]; break; }
                if (d > mejor.dif) mejor = { ancho: w, dif: d };
                previo = w;
            }
            if (encaja) {
                var lo = encaja[0], hi = encaja[1];
                for (var i = 0; i < 10 && hi - lo > 1; i++) {
                    var mitad = (lo + hi) / 2;
                    if (probarAncho(mitad) < -1) lo = mitad; else hi = mitad;
                }
                probarAncho(hi);
            } else if (mejor.ancho === null) {
                col.style.width = col.style.maxWidth = "";   // ensanchar no mejora: se queda con su ancho de clase
                ajustar();
            } else {
                probarAncho(mejor.ancho);
            }
        }

        function ajustar() {
            restaurar(imgs);
            var objetivo = vecina.getBoundingClientRect().height;

            // Alto actual del contenido de la columna (con las imágenes a ancho completo y proporción real)
            var actual = altoContenido(col);
            var extraPorImagen = (objetivo - actual) / imgs.length;

            imgs.forEach(function (img) {
                var proporcion = img.naturalWidth / img.naturalHeight;   // ancho / alto real
                var anchoMax = img.getBoundingClientRect().width;        // ancho disponible
                var natural = anchoMax / proporcion;                     // alto a ancho completo sin recorte
                var deseado = natural + extraPorImagen;
                var ancho = anchoMax;

                // 1) Recorte desde el centro, como mucho (1 - k): clamp(mínimo, deseado, máximo)
                var alto = Math.min(Math.max(deseado, natural * k), natural / k);

                // 2) Si aun así sobra alto: se ESCALA la imagen entera (más estrecha, misma proporción),
                //    aprovechando el recorte máximo para que quede lo más grande posible
                if (deseado < natural * k) {
                    alto = Math.max(deseado, 0);
                    ancho = Math.min(anchoMax, alto * proporcion / k);
                }

                img.style.width = ancho + "px";
                img.style.height = alto + "px";

                // El marco (si lo hay) se ajusta al nuevo ancho de la imagen
                var env = img.closest(".pf-envoltorio");
                if (env && ancho < anchoMax) {
                    env.style.width = (env.getBoundingClientRect().width - anchoMax + ancho) + "px";
                }
            });
        }
    });
}

(function () {
    var pendiente;
    function programar() { cancelAnimationFrame(pendiente); pendiente = requestAnimationFrame(pfIgualarAltos); }
    window.addEventListener("load", programar);
    window.addEventListener("resize", programar);
    document.addEventListener("DOMContentLoaded", function () {
        document.querySelectorAll(".pf-igualar-alto img").forEach(function (img) {
            img.addEventListener("load", programar);
        });
        if ("ResizeObserver" in window) {   // si cambia el alto del texto vecino (fuentes, etc.)
            var ro = new ResizeObserver(programar);
            document.querySelectorAll(".pf-igualar-alto").forEach(function (col) {
                var v = col.previousElementSibling || col.nextElementSibling;
                if (v) ro.observe(v);
            });
        }
    });
})();

/* Cartel sin arte · si --cartel-img-esquina es "none", añade "pf-sin-cartel" a <html>
   (el CSS hace que el marrón de respaldo ocupe toda la caja del cartel). */
document.addEventListener("DOMContentLoaded", function () {
    var esquina = getComputedStyle(document.documentElement).getPropertyValue("--cartel-img-esquina").trim();
    if (!esquina || esquina === "none") document.documentElement.classList.add("pf-sin-cartel");
});

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