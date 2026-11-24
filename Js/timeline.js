/* ============================================================
   timeline.js · en escritorio/tablet la rueda del ratón mueve la
   línea de tiempo hacia la DERECHA (scroll horizontal).
   En móvil (≤ 576px) no hace nada: la línea es vertical y se baja normal.
   Al llegar a un extremo, la rueda vuelve a mover la página con normalidad.
   En móvil, el botón .timeline-voltear voltea entre las 2 caras (.timeline-cara).
   ============================================================ */
(function () {
    var MOVIL = window.matchMedia("(max-width: 576px)");
    var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

    /* ------------------------------------------------------------
       Coloca cada caja según sus fechas y crea la regla de meses y las marcas de año.
         data-desde="2019-09"  (año-mes, obligatorio)
         data-hasta="2020-06"  (año-mes, incluido; si falta = solo ese mes)
         data-hasta="actualidad"  (hasta el mes en curso; se actualiza solo. También vale "actual")
       El rango va del primer mes con algo al último (no tiene por qué ser años completos).
       Se puede forzar con data-desde / data-hasta en .timeline-wrapper.
       ------------------------------------------------------------ */
    function mesDe(texto) {   // "2019-09" → nº de meses desde el año 0
        texto = (texto || "").trim().toLowerCase();
        if (texto === "actualidad" || texto === "actual") {
            var hoy = new Date();
            return hoy.getFullYear() * 12 + hoy.getMonth();
        }
        var m = /^(\d{4})-(\d{1,2})$/.exec(texto);
        return m ? (+m[1]) * 12 + (+m[2] - 1) : null;
    }

    // Lee las fechas de una caja (las guarda en c._pfDesde / c._pfHasta). Devuelve false si no son válidas.
    function leerFechas(c) {
        var d = mesDe(c.dataset.desde), h = mesDe(c.dataset.hasta);
        if (d === null) { console.warn("timeline: data-desde no válido (usa AAAA-MM o actualidad)", c); return false; }
        if (h === null || h < d) h = d;
        c._pfDesde = d; c._pfHasta = h;
        return true;
    }

    // Coloca una caja en sus meses de la rejilla (min = primer mes de la línea)
    function posicionar(c, min) {
        if (!leerFechas(c)) return;
        c.style.setProperty("--pos", (c._pfDesde - min + 1) + " / span " + (c._pfHasta - c._pfDesde + 1));
    }

    /* ------------------------------------------------------------
       Empaqueta eventos: en el HTML cada evento puede ir en su propio bloque
       (su fila de línea secundaria + la(s) fila(s) de descripción de debajo).
       Los eventos que NO coinciden en fechas se juntan en las mismas filas (uno detrás
       de otro en el tiempo); solo se abre otra fila cuando dos se solapan de verdad.
       Recibe GRUPOS: [{ cara, filas }]. Cada evento prefiere quedarse en su grupo (su cara),
       pero si ahí no cabe sin abrir otra fila y en otro grupo sí, se muda a ese grupo.
       Solo se abre fila nueva cuando no cabe en ninguno (y en el grupo que menos tenga).
       ------------------------------------------------------------ */
    function esFilaDeLinea(fila) { return !!fila.querySelector(":scope > .timeline-box"); }

    // Bloques de un grupo: cada fila de línea secundaria + las filas de descripción que la siguen.
    // Las fechas del evento son las de su LÍNEA (la etiqueta); las descripciones la acompañan.
    function bloquesDe(filas, grupo) {
        var bloques = [];
        Array.prototype.forEach.call(filas, function (fila) {
            if (esFilaDeLinea(fila) || !bloques.length) bloques.push({ filas: [], grupo: grupo });
            bloques[bloques.length - 1].filas.push(fila);
        });
        bloques.forEach(function (b) {
            b.desde = Infinity; b.hasta = -Infinity;
            var conLinea = b.filas.filter(esFilaDeLinea);
            (conLinea.length ? conLinea : b.filas).forEach(function (f) {
                Array.prototype.forEach.call(f.children, function (c) {
                    if (c._pfDesde === undefined) return;
                    b.desde = Math.min(b.desde, c._pfDesde);
                    b.hasta = Math.max(b.hasta, c._pfHasta);
                });
            });
        });
        return bloques;
    }

    function empaquetarEventos(grupos) {
        var bloques = [];
        grupos.forEach(function (g, i) { bloques = bloques.concat(bloquesDe(g.filas, i)); });
        var carriles = grupos.map(function () { return []; });   // carriles (filas) de cada grupo

        bloques.filter(function (b) { return b.desde !== Infinity; })
            .sort(function (a, b) { return a.desde - b.desde; })
            .forEach(function (b) {
                // Orden de preferencia: su grupo y luego los demás
                var orden = [b.grupo].concat(grupos.map(function (_, i) { return i; }).filter(function (i) { return i !== b.grupo; }));
                var gi = -1, carril = null;
                for (var k = 0; k < orden.length && !carril; k++) {
                    carril = carriles[orden[k]].find(function (c) { return c.hasta < b.desde; }) || null;
                    if (carril) gi = orden[k];
                }
                if (!carril) {
                    // No cabe en ningún carril: carril nuevo en el grupo que menos tenga (empate → el suyo)
                    gi = orden.reduce(function (m, i) { return carriles[i].length < carriles[m].length ? i : m; }, b.grupo);
                    carril = { hasta: -Infinity, filas: null };
                    carriles[gi].push(carril);
                }
                var cara = grupos[gi].cara;
                if (!carril.filas) {
                    carril.filas = b.filas;                                   // carril nuevo: se queda con las filas del bloque
                    if (gi !== b.grupo && cara) b.filas.forEach(function (f) { cara.appendChild(f); });
                } else {
                    // Mueve las cajas del bloque a las filas del carril (línea con línea, descripción con descripción)
                    b.filas.forEach(function (f, i) {
                        var destino = carril.filas[i];
                        if (!destino) { carril.filas.push(f); if (gi !== b.grupo && cara) cara.appendChild(f); return; }
                        while (f.firstChild) destino.appendChild(f.firstChild);
                        f.remove();
                    });
                }
                carril.hasta = Math.max(carril.hasta, b.hasta);
            });
    }

    /* ------------------------------------------------------------
       Reparte los eventos de las caras en filas:
         · ESCRITORIO: se ven las dos caras a la vez → se empaquetan TODOS juntos
           (un evento de la Línea 2 puede ocupar un hueco libre de una fila de la Línea 1).
         · MÓVIL: solo se ve una cara cada vez y cada una debe aprovechar TODO el ancho →
           cada evento se queda en su cara si cabe; si no, pasa a la otra cara si allí cabe.
       Cada vez parte del HTML original (por si se cambia de escritorio a móvil o al revés).
       ------------------------------------------------------------ */
    function repartirEventos(wrapper) {
        var caras = wrapper.querySelectorAll(".timeline-cara");
        caras.forEach(function (cara) {
            if (!cara._pfOriginal) cara._pfOriginal = Array.prototype.map.call(cara.childNodes, function (n) { return n.cloneNode(true); });
            else cara.replaceChildren.apply(cara, cara._pfOriginal.map(function (n) { return n.cloneNode(true); }));
        });
        wrapper.querySelectorAll(".timeline-cara .timeline-fila > [data-desde]").forEach(function (c) {
            posicionar(c, wrapper._pfMin);
        });
        if (MOVIL.matches) {
            empaquetarEventos(Array.prototype.map.call(caras, function (cara) {
                return { cara: cara, filas: cara.querySelectorAll(":scope > .timeline-fila") };
            }));
        } else {
            empaquetarEventos([{ cara: null, filas: wrapper.querySelectorAll(".timeline-cara > .timeline-fila") }]);
        }
        ajustarTextos(wrapper);
    }

    /* ------------------------------------------------------------
       Textos que no caben: si el texto de una línea no entra en su caja, se reduce
       poco a poco (hasta el 55% de su tamaño) hasta que quepa.
       ------------------------------------------------------------ */
    function ajustarTextos(wrapper) {
        wrapper.querySelectorAll(".timeline-box > p").forEach(function (p) {
            var caja = p.parentElement;
            p.style.fontSize = "";
            var base = parseFloat(getComputedStyle(p).fontSize), tam = base;
            function noCabe() {
                var e = getComputedStyle(caja);
                var alto = caja.clientHeight - parseFloat(e.paddingTop) - parseFloat(e.paddingBottom);
                return p.offsetHeight > alto + 1 || p.scrollWidth > p.clientWidth + 1;
            }
            while (noCabe() && tam > base * 0.55) {
                tam *= 0.92;
                p.style.fontSize = tam + "px";
            }
        });
    }

    function colocarPorFechas(wrapper) {
        var cajas = wrapper.querySelectorAll(".timeline-fila > [data-desde]");
        var min = Infinity, max = -Infinity;
        cajas.forEach(function (c) {
            if (!leerFechas(c)) return;
            min = Math.min(min, c._pfDesde); max = Math.max(max, c._pfHasta);
        });

        if (mesDe(wrapper.dataset.desde) !== null) min = mesDe(wrapper.dataset.desde);
        if (mesDe(wrapper.dataset.hasta) !== null) max = mesDe(wrapper.dataset.hasta);
        if (min === Infinity) return;
        var total = max - min + 1;                  // del primer mes con algo al último (no años completos)
        wrapper.style.setProperty("--total-meses", total);
        wrapper._pfMin = min;

        cajas.forEach(function (c) { posicionar(c, min); });
        repartirEventos(wrapper);

        // Reajusta el tamaño de los textos si cambia el ancho de pantalla o termina de cargar la fuente
        var pendiente;
        function reajustar() { cancelAnimationFrame(pendiente); pendiente = requestAnimationFrame(function () { ajustarTextos(wrapper); }); }
        window.addEventListener("resize", reajustar);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(reajustar);

        if (MOVIL.addEventListener) MOVIL.addEventListener("change", function () { repartirEventos(wrapper); });
        else if (MOVIL.addListener) MOVIL.addListener(function () { repartirEventos(wrapper); });

        // Regla de meses (muescas): arriba en escritorio, a la izquierda en móvil
        var vieja = wrapper.querySelector(":scope > .timeline-regla");
        if (vieja) vieja.remove();
        wrapper.querySelectorAll(":scope > .timeline-marca-anio").forEach(function (m) { m.remove(); });
        var regla = document.createElement("div");
        regla.className = "timeline-regla";
        regla.setAttribute("aria-hidden", "true");
        for (var i = 0; i < total; i++) {
            var abs = min + i, anio = Math.floor(abs / 12), mes = abs % 12;
            var muesca = document.createElement("span");
            muesca.className = "timeline-mes" + (mes === 0 ? " enero" : "") + (i === 0 && mes !== 0 ? " inicio" : "");
            muesca.title = MESES[mes] + " " + anio;
            muesca.dataset.mes = mes + 1;                               // nº de mes (1-12)
            if (mes === 0 || i === 0) muesca.dataset.anio = anio;      // año en cada enero (y al principio)
            regla.appendChild(muesca);
        }
        wrapper.insertBefore(regla, wrapper.firstChild);

        // Marcas de año: una en cada enero (y al final si la línea acaba en diciembre), cruzando toda la línea
        for (var a = 0; a <= total; a++) {
            if ((min + a) % 12 !== 0) continue;
            var marca = document.createElement("span");
            marca.className = "timeline-marca-anio";
            marca.setAttribute("aria-hidden", "true");
            marca.style.setProperty("--i", a);
            wrapper.appendChild(marca);
        }
    }

    /* ------------------------------------------------------------
       CIELO POR PIEZAS · crea .timeline-cielo dentro del contenedor (se desplaza con él)
         · Estrellas: baldosas que cubren toda la línea (2:3, como las imágenes). En escritorio
           ocupan el alto y van hacia la derecha; en móvil ocupan el ancho y van hacia abajo.
           Cada una: variante + orientación (normal / espejo / volteada) con azar natural.
         · Nebulosas: --cielo-nebulosas-por-pantalla de media; el recorrido se parte en tramos
           y en cada tramo cae UNA en un sitio al azar (así no se amontonan ni dejan huecos).
       Lo elegido se guarda: al cambiar de tamaño solo se recoloca (no se baraja de nuevo).
       Devuelve la función que lo recoloca (o null si no hay arte ni azar disponibles).
       ------------------------------------------------------------ */
    var ORIENTACIONES = ["", "scaleX(-1)", "scaleY(-1)", "scale(-1, -1)"];

    function crearCielo(contenedor) {
        if (typeof pfAzar !== "function" || typeof pfVariantes !== "function") return null;
        var raiz = document.documentElement;
        var estilo = getComputedStyle(raiz);
        function num(nombre, defecto) { var v = parseFloat(estilo.getPropertyValue(nombre)); return isNaN(v) ? defecto : v; }
        function rango(a, b) { return a + Math.random() * (b - a); }

        var estrellas = pfVariantes(raiz, "--cielo-estrellas-");
        var nebulosas = pfVariantes(raiz, "--cielo-nebulosa-", 4);
        var v1 = estilo.getPropertyValue("--cielo-estrellas-1").trim();
        if (!v1 || v1 === "none") return null;                              // sin arte: se queda el cielo de respaldo

        var combinaciones = [];                                             // variante × orientación
        estrellas.forEach(function (v) { ORIENTACIONES.forEach(function (_, o) { combinaciones.push(v + "-" + o); }); });

        var capa = document.createElement("div");
        capa.className = "timeline-cielo";
        capa.setAttribute("aria-hidden", "true");
        contenedor.insertBefore(capa, contenedor.firstChild);
        raiz.classList.add("pf-cielo-piezas");                              // apaga la imagen de respaldo de <html>

        var est = { eje: null, baldosas: [], nebulosas: [] };

        return function montar() {
            var movil = MOVIL.matches, eje = movil ? "y" : "x";
            if (est.eje !== eje) { est = { eje: eje, baldosas: [], nebulosas: [] }; capa.textContent = ""; }

            capa.style.width = capa.style.height = "0px";                   // que no cuente al medir
            var W = contenedor.scrollWidth, H = contenedor.scrollHeight;
            var vw = contenedor.clientWidth, vh = contenedor.clientHeight;
            capa.style.width = W + "px"; capa.style.height = H + "px";

            // --- Estrellas (baldosas 2:3) ---
            var bw = movil ? W : H / 1.5, bh = movil ? W * 1.5 : H;
            var n = Math.ceil((movil ? H / bh : W / bw)) || 1;
            while (est.baldosas.length < n) {
                var c = pfAzar("cielo-estrellas", combinaciones).split("-");
                var b = document.createElement("span");
                b.className = "timeline-cielo-estrellas";
                b.dataset.v = c[0];
                b.style.transform = ORIENTACIONES[+c[1]];
                capa.appendChild(b);
                est.baldosas.push(b);
            }
            est.baldosas.forEach(function (b, i) {
                b.style.display = i < n ? "" : "none";
                b.style.width = bw + "px"; b.style.height = bh + "px";
                b.style.left = (movil ? 0 : i * bw) + "px";
                b.style.top = (movil ? i * bh : 0) + "px";
            });

            // --- Nebulosas (una por tramo, en un sitio al azar del tramo) ---
            var largo = movil ? H : W, pantalla = movil ? vh : vw, ancho = movil ? W : H;
            var tramo = pantalla / Math.max(0.1, num("--cielo-nebulosas-por-pantalla", 1.3));
            var m = Math.ceil(largo / tramo);
            var lado = Math.min(vw, vh);
            while (est.nebulosas.length < m) {
                var k = est.nebulosas.length;
                var e = document.createElement("span");
                e.className = "timeline-cielo-nebulosa";
                e.dataset.v = pfAzar("cielo-nebulosa", nebulosas);
                e.style.opacity = rango(num("--cielo-nebulosa-opacidad-min", 0.18), num("--cielo-nebulosa-opacidad-max", 0.35));
                e.style.transform = "rotate(" + Math.round(rango(0, 360)) + "deg)" + (Math.random() < 0.5 ? " scaleX(-1)" : "");
                capa.appendChild(e);
                est.nebulosas.push({ el: e, k: k, a: Math.random(), b: Math.random(),
                                     t: rango(num("--cielo-nebulosa-tam-min", 0.5), num("--cielo-nebulosa-tam-max", 1)) });
            }
            est.nebulosas.forEach(function (o) {
                var visible = o.k < m;
                o.el.style.display = visible ? "" : "none";
                if (!visible) return;
                var tam = o.t * lado;
                var a = (o.k + o.a) * tramo - tam / 2;          // a lo largo: dentro de su tramo
                var b = o.b * ancho - tam / 2;                   // a lo ancho: en cualquier sitio
                o.el.style.width = o.el.style.height = tam + "px";
                o.el.style.left = (movil ? b : a) + "px";
                o.el.style.top = (movil ? a : b) + "px";
            });
        };
    }

    document.addEventListener("DOMContentLoaded", function () {
        var contenedor = document.querySelector(".timeline-container");
        if (!contenedor) return;

        var wrapper = document.querySelector(".timeline-wrapper");
        if (wrapper) colocarPorFechas(wrapper);

        // Cielo por piezas (estrellas + nebulosas al azar) debajo de toda la línea
        var montarCielo = crearCielo(contenedor);
        if (montarCielo) {
            var pendienteCielo;
            var recolocarCielo = function () {
                cancelAnimationFrame(pendienteCielo);
                pendienteCielo = requestAnimationFrame(montarCielo);
            };
            if ("ResizeObserver" in window) {
                var roCielo = new ResizeObserver(recolocarCielo);
                roCielo.observe(contenedor);
                if (wrapper) roCielo.observe(wrapper);
            } else window.addEventListener("resize", recolocarCielo);
            if (MOVIL.addEventListener) MOVIL.addEventListener("change", recolocarCielo);
            montarCielo();
        }

        // El fondo (cielo estrellado de <html>) se desplaza con el contenedor, como si
        // hiciera scroll la página entera: hacia la derecha en escritorio, hacia abajo en móvil.
        var raiz = document.documentElement;
        function moverFondo() {
            raiz.style.setProperty("--fondo-scroll-x", contenedor.scrollLeft + "px");
            raiz.style.setProperty("--fondo-scroll-y", contenedor.scrollTop + "px");
        }
        contenedor.addEventListener("scroll", moverFondo, { passive: true });
        moverFondo();

        /* ---- Textos que ACOMPAÑAN al desplazarte ----
           El texto de cada línea se mantiene en el CENTRO de la pantalla mientras se recorre
           la línea; cuando la caja se acaba y ya no puede seguir centrado, se queda junto a
           su borde (respetando el relleno de la caja). En escritorio se mueve en horizontal
           y en móvil en vertical (sin contar la zona del botón de abajo).
           Las líneas CORTAS (MESES_FIJO meses o menos) no acompañan: su texto se queda quieto. */
        var ZONA_BOTON = 88;   // px de abajo que tapa el botón de volteo en móvil
        var MESES_FIJO = 2;    // líneas de esta duración o menos: el texto no se mueve
        function acompanarTextos() {
            if (!wrapper) return;
            var movil = MOVIL.matches;
            var cr = contenedor.getBoundingClientRect();
            var ini = movil ? cr.top : cr.left;
            var fin = movil ? cr.bottom - ZONA_BOTON : cr.right;
            var centro = (ini + fin) / 2, margen = fin - ini;
            wrapper.querySelectorAll(".timeline-box > p").forEach(function (p) {
                var caja = p.parentElement;
                if (caja._pfDesde !== undefined && caja._pfHasta - caja._pfDesde + 1 <= MESES_FIJO) {
                    if (p._pfT) { p._pfT = 0; p.style.transform = ""; }      // corta: quieta en su sitio
                    return;
                }
                var cara = caja.closest(".timeline-cara");
                if (cara && cara.inert) return;                              // cara oculta (móvil)
                var b = caja.getBoundingClientRect();
                var bIni = movil ? b.top : b.left, bFin = movil ? b.bottom : b.right;
                if (bFin < ini - margen || bIni > fin + margen) return;    // lejos de la pantalla: no se toca
                var r = p.getBoundingClientRect();
                var tam = movil ? r.height : r.width;
                var natural = (movil ? r.top : r.left) - (p._pfT || 0) + tam / 2;   // centro sin desplazar
                var e = getComputedStyle(caja);
                var padIni = movil ? parseFloat(e.paddingTop) + parseFloat(e.borderTopWidth)
                                   : parseFloat(e.paddingLeft) + parseFloat(e.borderLeftWidth);
                var padFin = movil ? parseFloat(e.paddingBottom) + parseFloat(e.borderBottomWidth)
                                   : parseFloat(e.paddingRight) + parseFloat(e.borderRightWidth);
                var lo = bIni + padIni + tam / 2, hi = bFin - padFin - tam / 2;
                var t = lo > hi ? 0 : Math.min(Math.max(centro, lo), hi) - natural;
                p._pfT = t;
                p.style.transform = movil ? "translateY(" + t + "px)" : "translateX(" + t + "px)";
            });
        }
        function reiniciarTextos() {   // al cambiar entre escritorio y móvil cambia el eje
            if (!wrapper) return;
            wrapper.querySelectorAll(".timeline-box > p").forEach(function (p) { p._pfT = 0; p.style.transform = ""; });
            acompanarTextos();
        }

        var avisarOtraCara = function () {};   // (se define abajo, con las caras)
        var pendienteScroll;
        function alDesplazar() {
            cancelAnimationFrame(pendienteScroll);
            pendienteScroll = requestAnimationFrame(function () { acompanarTextos(); avisarOtraCara(); });
        }
        contenedor.addEventListener("scroll", alDesplazar, { passive: true });
        window.addEventListener("resize", alDesplazar);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(alDesplazar);

        // ---- Móvil: 2 caras (líneas paralelas) que se voltean con el botón ----
        var caras = document.querySelector(".timeline-caras");
        var boton = document.querySelector(".timeline-voltear");
        if (caras && boton) {
            var lista = caras.querySelectorAll(":scope > .timeline-cara");
            var texto = boton.querySelector(".timeline-voltear-texto");
            var actual = 0;

            function nombre(i) { return lista[i] && lista[i].dataset.nombre || "Cara " + "AB"[i]; }

            // Solo la cara visible se puede usar (ratón, teclado, lector de pantalla).
            // En escritorio se ven todas, así que ninguna se bloquea.
            function actualizar() {
                lista.forEach(function (cara, i) {
                    var oculta = MOVIL.matches && i !== actual;
                    cara.inert = oculta;
                    if (oculta) cara.setAttribute("aria-hidden", "true"); else cara.removeAttribute("aria-hidden");
                });
                var otra = (actual + 1) % lista.length;
                if (texto) texto.textContent = nombre(otra);
                boton.setAttribute("aria-label", "Ver " + nombre(otra) + " (ahora: " + nombre(actual) + ")");
                boton.setAttribute("aria-pressed", actual === 1 ? "true" : "false");
                caras.classList.toggle("volteada", actual === 1);
            }

            // Aviso: el botón PARPADEA si en la otra cara hay algo (línea secundaria o su texto)
            // que YA se vería en pantalla si volteases.
            var AVISO_MIN = 40;   // px de ese algo que tienen que entrar en pantalla para avisar
            avisarOtraCara = function () {
                var hay = false;
                if (MOVIL.matches && lista.length > 1) {
                    var otra = lista[(actual + 1) % lista.length];
                    // Zona visible de verdad (sin la franja que tapa el botón). Hace falta que algo
                    // de la otra cara entre al menos AVISO_MIN px en ella: así no avisa antes de tiempo.
                    var cr = contenedor.getBoundingClientRect();
                    var arriba = cr.top, abajo = cr.bottom - ZONA_BOTON;
                    hay = Array.prototype.some.call(otra.querySelectorAll(".timeline-fila > [data-desde]"), function (c) {
                        var r = c.getBoundingClientRect();
                        return Math.min(r.bottom, abajo) - Math.max(r.top, arriba) >= AVISO_MIN;
                    });
                }
                boton.classList.toggle("timeline-aviso", hay);
            };

            boton.addEventListener("click", function () {
                if (lista.length < 2) return;
                // El giro se hace a la altura de lo que se está viendo (no a la mitad de toda la línea)
                var y = contenedor.scrollTop + contenedor.clientHeight / 2
                      - (caras.getBoundingClientRect().top - contenedor.getBoundingClientRect().top + contenedor.scrollTop);
                caras.style.setProperty("--volteo-origen-y", Math.max(0, y) + "px");
                actual = (actual + 1) % lista.length;
                actualizar();
                alDesplazar();
            });

            if (MOVIL.addEventListener) MOVIL.addEventListener("change", actualizar);
            else if (MOVIL.addListener) MOVIL.addListener(actualizar);   // Safari antiguo
            actualizar();
        }

        // Al pasar de escritorio a móvil (o al revés) se reparten los eventos de nuevo y cambia el eje
        if (MOVIL.addEventListener) MOVIL.addEventListener("change", reiniciarTextos);
        else if (MOVIL.addListener) MOVIL.addListener(reiniciarTextos);
        reiniciarTextos();
        avisarOtraCara();

        window.addEventListener("wheel", function (e) {
            if (MOVIL.matches || e.ctrlKey) return;                 // móvil o zoom: comportamiento normal
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;    // trackpad ya en horizontal: lo deja tal cual

            // deltaMode: 0 = píxeles, 1 = líneas, 2 = páginas
            var delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? contenedor.clientWidth : 1);
            var max = contenedor.scrollWidth - contenedor.clientWidth;
            var puede = delta > 0 ? contenedor.scrollLeft < max - 1 : contenedor.scrollLeft > 0;
            if (!puede) return;                                      // en el extremo: la página baja/sube normal

            e.preventDefault();
            // Suave, con los mismos ajustes que el resto de la web (--scroll-suavidad / --scroll-velocidad)
            if (window.pfScrollSuave) window.pfScrollSuave(contenedor, "x", delta);
            else contenedor.scrollLeft += delta;
        }, { passive: false, capture: true });   // capture: va ANTES que el desplazamiento suave vertical general
    });
})();
