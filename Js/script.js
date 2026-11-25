/* ============================================================
   pfPagina · ciclo de vida de cada página (lo define Js/transicion.js, en el <head>).
   La web no recarga al cambiar de sección: lo que antes se hacía en DOMContentLoaded
   va en pfPagina.alIniciar, y lo que se engancha a window/document, por pfPagina.escuchar
   (así se quita al irse). Si una página no carga transicion.js, esto hace lo de siempre.
   ============================================================ */
var pfPagina = window.pfPagina || {
    alIniciar: function (fn) { document.addEventListener("DOMContentLoaded", fn); },
    alCargar: function (fn) { if (document.readyState === "complete") fn(); else window.addEventListener("load", fn); },
    escuchar: function (objeto, evento, fn, opciones) {
        if (objeto.addEventListener) objeto.addEventListener(evento, fn, opciones);
        else if (objeto.addListener) objeto.addListener(fn);
    },
    observar: function (obs) { return obs; },
    alSalir: function () {}
};

/* ============================================================
   Azar "natural" · para escoger variantes de arte (lados de hojas, tablones, cielo...)
   El azar puro hace rachas (la misma 4 veces seguidas) y a la gente no le parece
   aleatorio. Esto funciona como una bolsa: se barajan todas las variantes, se
   sacan una a una y, al vaciarse, se vuelve a llenar sin repetir la última.
   Así todas salen por igual y nunca sale la misma dos veces seguidas.
       pfAzar("familia", [1, 2, 3])  → 1, 2 o 3
   ============================================================ */
var pfAzar = (function () {
    var bolsas = {};
    function barajar(a) {
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }
    return function (familia, opciones) {
        var clave = familia + ":" + opciones.join(",");
        var bolsa = bolsas[clave] || (bolsas[clave] = { cola: [], ultima: null });
        if (!bolsa.cola.length) {
            bolsa.cola = barajar(opciones.slice());
            if (bolsa.cola.length > 1 && bolsa.cola[0] === bolsa.ultima) {   // no repetir al rellenar
                var t = bolsa.cola[0]; bolsa.cola[0] = bolsa.cola[1]; bolsa.cola[1] = t;
            }
        }
        bolsa.ultima = bolsa.cola.shift();
        return bolsa.ultima;
    };
})();

/* Variantes (1, 2, 3...) de una imagen que tienen arte: las que no están en "none".
   Si no hay ninguna, devuelve [1]. Ej: pfVariantes(el, "--folio-img-lado-") */
function pfVariantes(el, prefijo, maximo) {
    var estilo = getComputedStyle(el), hay = [];
    for (var n = 1; n <= (maximo || 3); n++) {
        var v = estilo.getPropertyValue(prefijo + n).trim();
        if (v && v !== "none") hay.push(n);
    }
    return hay.length ? hay : [1];
}

/* ============================================================
   folio.js · crea las piezas (lados y esquinas) de cada .pf-folio
   No hay que tocar nada: basta con poner la clase "pf-folio" a un elemento.
   Cada lado escoge al azar una de las variantes --folio-img-lado-1/2/3.
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
        var variantes = pfVariantes(folio, "--folio-img-lado-");
        var familia = folio.classList.contains("pf-cartel") ? "cartel" : folio.classList.contains("pf-marco") ? "marco" : "folio";
        lados.forEach(function (lado) {
            var pieza = document.createElement("span");
            pieza.className = "pf-folio-pieza pf-folio-" + lado;
            pieza.setAttribute("aria-hidden", "true");
            pieza.dataset.v = pfAzar(familia, variantes);
            folio.appendChild(pieza);
        });
    });
}

pfPagina.alIniciar(function () { pfFolioIniciar(); pfCartelIniciar(); });

/* ============================================================
   CARTEL CON TABLONES · cada .pf-cartel (menos el de la línea de tiempo) pasa a ser
   un tablón claro (.pf-cartel-tablon) con una placa oscura encima (.pf-placa) que
   enmarca su contenido. Cada uno escoge al azar su variante (azar natural).
   Las variantes vienen de Css/decoracion-generada.css (--cartel-tablon-N / --cartel-placa-N).
   ============================================================ */
function pfCartelIniciar(raiz) {
    var raizCss = document.documentElement;
    var hayArte = getComputedStyle(raizCss).getPropertyValue("--cartel-tablon-1").trim();
    if (!hayArte || hayArte === "none") return;                  // sin las tiras: se queda el cartel de siempre
    var tablones = pfVariantes(raizCss, "--cartel-tablon-", 9);
    var placas = pfVariantes(raizCss, "--cartel-placa-", 9);

    (raiz || document).querySelectorAll(".pf-cartel").forEach(function (cartel) {
        if (cartel.closest(".timeline-cabecera") || cartel.classList.contains("pf-cartel-tablon")) return;
        cartel.classList.add("pf-cartel-tablon");
        cartel.dataset.v = pfAzar("cartel-tablon", tablones);
        var placa = document.createElement("div");
        placa.className = "pf-placa";
        placa.dataset.v = pfAzar("cartel-placa", placas);
        Array.prototype.slice.call(cartel.childNodes).forEach(function (n) {
            if (n.nodeType === 1 && n.classList.contains("pf-folio-pieza")) return;   // las piezas del folio se quedan fuera
            placa.appendChild(n);
        });
        cartel.insertBefore(placa, cartel.firstChild);
    });
}

/* ============================================================
   PALOS · data-palos="0.1 0.9" en un elemento = un palo a esa fracción de su ancho.
   Cada palo empieza asomando un poco por encima de SU elemento (--palo-asoma) y baja:
     · hasta esconderse detrás del primer elemento de data-palos-hasta que haya debajo, o
     · si no lo tiene, hasta clavarse en el césped del footer (.pf-suelo)
       (sin suelo: hasta el final de la página).
   Van en una capa (.pf-palos) por DETRÁS de carteles y tablones.
   Cada palo escoge al azar su punta (--palo-punta-N) y si va en espejo; se recolocan
   solos al cambiar el tamaño de la pantalla o al cargar imágenes.
   ============================================================ */
function pfPalosIniciar() {
    var anclas = document.querySelectorAll("[data-palos]");
    if (!anclas.length) return;
    var raizCss = document.documentElement;
    var punta1 = getComputedStyle(raizCss).getPropertyValue("--palo-punta-1").trim();
    if (!punta1 || punta1 === "none") return;
    var puntas = pfVariantes(raizCss, "--palo-punta-", 9);

    var capa = document.createElement("div");
    capa.className = "pf-palos";
    capa.setAttribute("aria-hidden", "true");
    document.body.appendChild(capa);

    // Un palo por cada fracción de cada ancla; su aspecto (punta, espejo) se elige una vez
    var palos = [];
    anclas.forEach(function (ancla) {
        (ancla.dataset.palos || "").trim().split(/\s+/).forEach(function (f) {
            var x = parseFloat(f);
            if (isNaN(x)) return;
            var el = document.createElement("span");
            el.className = "pf-palo";
            var punta = document.createElement("span");
            punta.className = "pf-palo-punta";
            punta.dataset.v = pfAzar("palo-punta", puntas);
            var tramo = document.createElement("span");
            tramo.className = "pf-palo-tramo";
            el.appendChild(punta); el.appendChild(tramo);
            if (pfAzar("palo-espejo", [0, 1])) el.style.transform = "scaleX(-1)";
            capa.appendChild(el);
            palos.push({ el: el, ancla: ancla, x: x });
        });
    });

    // Dónde acaba el palo de un ancla: detrás del primer elemento de data-palos-hasta que esté
    // DEBAJO del ancla (escondido: a media altura de ese elemento, como mucho 80 px dentro),
    // o clavado en la tierra del suelo.
    // (x = centro del palo: solo cuenta un destino que esté justo DEBAJO del palo, el primero que encuentre)
    function finDe(ancla, r, x) {
        var sel = ancla.dataset.palosHasta;
        if (sel) {
            var mejor = null;
            document.querySelectorAll(sel).forEach(function (el) {
                if (el === ancla) return;
                var d = el.getBoundingClientRect();
                if (d.top <= r.bottom - 1 || x < d.left || x > d.right) return;
                if (!mejor || d.top < mejor.top) mejor = d;
            });
            if (mejor) return mejor.top + Math.min(mejor.height / 2, 80);
        }
        var suelo = document.querySelector(".pf-suelo");
        if (suelo) { var s = suelo.getBoundingClientRect(); return s.top + s.height * 0.55; }
        return document.documentElement.scrollHeight - window.scrollY;
    }

    function colocar() {
        // Origen = la propia capa de palos (esquina del body). Se mide la capa y no el body porque,
        // durante la transición entre páginas, la capa se desplaza igual que lo que sujetan los palos.
        var origen = capa.getBoundingClientRect();
        var ox = origen.left, oy = origen.top;
        var asoma = parseFloat(getComputedStyle(raizCss).getPropertyValue("--palo-asoma")) || 22;
        var ancho = parseFloat(getComputedStyle(palos[0].el).width) || 20;

        palos.forEach(function (p) {
            var r = p.ancla.getBoundingClientRect();
            var arriba = Math.max(r.top - asoma, -window.scrollY);  // asoma por encima de SU elemento (sin salirse de la página)
            var centro = r.left + r.width * p.x;
            var abajo = finDe(p.ancla, r, centro);
            var x = centro - ancho / 2;
            p.el.style.left = (x - ox) + "px";
            p.el.style.top = (arriba - oy) + "px";
            p.el.style.height = Math.max(0, abajo - arriba) + "px";
        });
    }

    var pendiente;
    function programar() { cancelAnimationFrame(pendiente); pendiente = requestAnimationFrame(colocar); }
    colocar();
    pfPagina.escuchar(window, "resize", programar);
    pfPagina.alCargar(programar);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(programar);
    if ("ResizeObserver" in window) {   // cualquier cambio de tamaño de la página, de lo que sujetan o de lo que hay debajo
        var ro = pfPagina.observar(new ResizeObserver(programar));
        ro.observe(document.body);
        document.querySelectorAll("[data-palos], header, main, .pf-board, .pf-suelo").forEach(function (el) { ro.observe(el); });
    }
}

pfPagina.alIniciar(function () { setTimeout(pfPalosIniciar, 0); });   // después de montar carteles y tablones

/* ============================================================
   Desplazamiento SUAVE con la rueda del ratón (en toda la web)
   Se ajusta con dos variables del :root de Css/styles.css:
     --scroll-suavidad (0 a 1): parte del camino que recorre en cada fotograma.
         Más BAJO = más suave y "con inercia" (ej. 0.08) · más ALTO = más directo (ej. 0.3)
         1 = sin suavizado (como el navegador)
     --scroll-velocidad: cuánto avanza cada golpe de rueda (1 = normal, 1.5 = más, 0.7 = menos)
   Si el sistema tiene activado "reducir movimiento", no se suaviza.
   Otros scripts pueden usarlo: pfScrollSuave(elemento, "x" o "y", píxeles)
   ============================================================ */
var pfScrollSuave = (function () {
    var estados = new WeakMap();
    var reducir = window.matchMedia("(prefers-reduced-motion: reduce)");

    function ajustes() {
        var e = getComputedStyle(document.documentElement);
        var s = parseFloat(e.getPropertyValue("--scroll-suavidad"));
        var v = parseFloat(e.getPropertyValue("--scroll-velocidad"));
        return { suavidad: s > 0 && s <= 1 ? s : 0.12, velocidad: v > 0 ? v : 1 };
    }

    function colocar(el, eje, valor) {   // "instant" para que el navegador no lo vuelva a suavizar
        var o = { behavior: "instant" };
        o[eje === "x" ? "left" : "top"] = valor;
        el.scrollTo(o);
    }

    return function (el, eje, delta) {
        var a = ajustes();
        var prop = eje === "x" ? "scrollLeft" : "scrollTop";
        var max = eje === "x" ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
        var porEl = estados.get(el) || {};
        estados.set(el, porEl);
        var st = porEl[eje] || (porEl[eje] = { corriendo: false });
        if (!st.corriendo) st.pos = st.objetivo = el[prop];          // parte de donde esté (barra, teclado...)
        st.objetivo = Math.max(0, Math.min(max, st.objetivo + delta * a.velocidad));

        if (a.suavidad >= 1 || reducir.matches) { colocar(el, eje, st.objetivo); st.pos = st.objetivo; return; }
        if (st.corriendo) return;
        st.corriendo = true;
        (function paso() {
            var dif = st.objetivo - st.pos;
            if (Math.abs(dif) < 0.5) { colocar(el, eje, st.objetivo); st.corriendo = false; return; }
            st.pos += dif * a.suavidad;
            colocar(el, eje, st.pos);
            requestAnimationFrame(paso);
        })();
    };
})();

(function () {
    // ¿Qué hay que desplazar? El primer elemento (desde el ratón hacia fuera) que pueda moverse
    // en vertical en ese sentido; si ninguno, la página.
    function puedeMoverse(el, delta) {
        var max = el.scrollHeight - el.clientHeight;
        return max > 1 && (delta > 0 ? el.scrollTop < max - 1 : el.scrollTop > 0);
    }
    function buscar(desde, delta) {
        for (var el = desde; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
            if (!(el instanceof Element)) continue;
            var oy = getComputedStyle(el).overflowY;
            if ((oy === "auto" || oy === "scroll") && puedeMoverse(el, delta)) return el;
        }
        var pagina = document.scrollingElement || document.documentElement;
        return puedeMoverse(pagina, delta) ? pagina : null;
    }

    window.addEventListener("wheel", function (e) {
        if (e.defaultPrevented || e.ctrlKey) return;                      // otro script ya lo usó / zoom
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;             // gesto horizontal: lo deja tal cual
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        var delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
        var el = buscar(e.target, delta);
        if (!el) return;
        e.preventDefault();
        pfScrollSuave(el, "y", delta);
    }, { passive: false });
})();

/* ============================================================
   Tablón (.pf-board) · crea la capa de madera de cada tablón:
       borde de arriba + N tablones (centro) + borde de abajo (volteado)
   N = tablones enteros que caben en el alto (se recalcula al cambiar de tamaño).
   Cada tira escoge al azar su variante (--tablon-img-borde-1/2/3 y
   --tablon-img-centro-1/2/3); cada tablón central conserva la suya al redimensionar.
   Si añades tablones dinámicamente, llama a pfTablonIniciar(contenedor).
   ============================================================ */
var pfTablonObservador = "ResizeObserver" in window ? new ResizeObserver(function (entradas) {
    entradas.forEach(function (e) { pfTablonAjustar(e.target); });
}) : null;

function pfTablonIniciar(raiz) {
    (raiz || document).querySelectorAll(".pf-board").forEach(function (tablon) {
        if (tablon.querySelector(":scope > .pf-tablon-capa")) return;   // ya tiene su capa
        var bordes = pfVariantes(tablon, "--tablon-img-borde-", 6);
        var capa = document.createElement("span");
        capa.className = "pf-tablon-capa";
        capa.setAttribute("aria-hidden", "true");
        ["", " pf-tablon-borde-abajo"].forEach(function (extra) {
            var borde = document.createElement("span");
            borde.className = "pf-tablon-borde" + extra;
            borde.dataset.v = pfAzar("tablon-borde", bordes);
            capa.appendChild(borde);
        });
        tablon.insertBefore(capa, tablon.firstChild);
        tablon._pfCentros = [];   // variantes ya escogidas para cada tablón central
        pfTablonAjustar(tablon);
        if (pfTablonObservador) pfTablonObservador.observe(tablon);
    });
}

function pfTablonAjustar(tablon) {
    var capa = tablon.querySelector(":scope > .pf-tablon-capa");
    if (!capa) return;
    var estilo = getComputedStyle(tablon);
    var escala = parseFloat(estilo.getPropertyValue("--tablon-escala")) || 0.22;
    var altoBorde = (parseFloat(estilo.getPropertyValue("--tablon-img-borde")) || 349) * escala;
    var altoTablon = (parseFloat(estilo.getPropertyValue("--tablon-img-tablon")) || 690) * escala;

    // Nº entero de tablones que caben, estirados para llenar (como el antiguo border-image "round")
    var n = Math.max(1, Math.round((tablon.offsetHeight - 2 * altoBorde) / altoTablon));
    var centros = capa.querySelectorAll(".pf-tablon-centro");
    if (centros.length === n) return;

    var variantes = pfVariantes(tablon, "--tablon-img-centro-", 6);
    while (tablon._pfCentros.length < n) tablon._pfCentros.push(pfAzar("tablon-centro", variantes));
    centros.forEach(function (c) { c.remove(); });
    var abajo = capa.lastChild;
    for (var i = 0; i < n; i++) {
        var centro = document.createElement("span");
        centro.className = "pf-tablon-centro";
        centro.dataset.v = tablon._pfCentros[i];
        capa.insertBefore(centro, abajo);
    }
}

/* Tablón sin arte · si alguna imagen de la madera no carga (o no hay ninguna),
   añade la clase "pf-sin-tablon" a <html> y el CSS pinta el tablón de marrón (--tablon-respaldo). */
function pfTablonComprobar() {
    var tiras = document.querySelectorAll(".pf-tablon-capa > *");
    if (!tiras.length) return;
    var urls = [];
    tiras.forEach(function (t) {
        getComputedStyle(t).borderImageSource.replace(/url\(["']?([^"')]+)["']?\)/g, function (_, u) {
            if (urls.indexOf(u) < 0) urls.push(u);
        });
    });

    function sinArte() { document.documentElement.classList.add("pf-sin-tablon"); }
    if (!urls.length) { sinArte(); return; }
    urls.forEach(function (u) {
        var img = new Image();
        img.onerror = sinArte;
        img.src = u;
    });
}

pfPagina.alIniciar(function () {
    pfTablonIniciar();
    pfTablonComprobar();
    // Al cambiar de página, deja de vigilar los tablones viejos (se reutiliza para los nuevos)
    if (pfTablonObservador) pfPagina.alSalir(function () { pfTablonObservador.disconnect(); });
});

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

pfPagina.alIniciar(function () {
    if (!document.querySelector(".pf-igualar-alto")) return;
    var pendiente;
    function programar() { cancelAnimationFrame(pendiente); pendiente = requestAnimationFrame(pfIgualarAltos); }
    pfPagina.alCargar(programar);
    pfPagina.escuchar(window, "resize", programar);
    document.querySelectorAll(".pf-igualar-alto img").forEach(function (img) {
        img.addEventListener("load", programar);
    });
    if ("ResizeObserver" in window) {   // si cambia el alto del texto vecino (fuentes, etc.)
        var ro = pfPagina.observar(new ResizeObserver(programar));
        document.querySelectorAll(".pf-igualar-alto").forEach(function (col) {
            var v = col.previousElementSibling || col.nextElementSibling;
            if (v) ro.observe(v);
        });
    }
    programar();
});

/* Cartel sin arte · si --cartel-img-esquina es "none", añade "pf-sin-cartel" a <html>
   (el CSS hace que el marrón de respaldo ocupe toda la caja del cartel). */
pfPagina.alIniciar(function () {
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
        var observador = pfPagina.observar(new ResizeObserver(medir));
        tablones.forEach(function (t) { observador.observe(t); });
    } else {
        pfPagina.escuchar(window, "resize", medir);
        pfPagina.alCargar(medir);
    }
    medir();
}

pfPagina.alIniciar(pfProyectosIniciar);

/* ============================================================
   Carruseles de Bootstrap con data-bs-ride="carousel" · Bootstrap los pone en marcha al
   cargar la ventana, cosa que no pasa al cambiar de sección por dentro: se hace aquí.
   Al irse, se paran (si no, seguirían girando aunque ya no estén en la página).
   ============================================================ */
pfPagina.alIniciar(function () {
    var carruseles = document.querySelectorAll('[data-bs-ride="carousel"]');
    if (!carruseles.length) return;
    pfPagina.alCargar(function () {
        if (!window.bootstrap || !window.bootstrap.Carousel) return;
        carruseles.forEach(function (c) { window.bootstrap.Carousel.getOrCreateInstance(c); });
    });
    pfPagina.alSalir(function () {
        if (!window.bootstrap || !window.bootstrap.Carousel) return;
        carruseles.forEach(function (c) {
            var instancia = window.bootstrap.Carousel.getInstance(c);
            if (instancia) instancia.dispose();
        });
    });
});