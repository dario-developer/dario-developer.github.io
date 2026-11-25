/* ============================================================
   transicion.js · TRANSICIONES ENTRE PÁGINAS (sin cortes)
   Al pulsar un enlace a otra página de la web NO se cambia de página de verdad:
   la página nueva se carga por dentro mientras dura el viaje, y se cambia el
   contenido con el cielo tapándolo. Así la animación nunca se corta.
   El viaje tiene 3 tramos:
     1. SALIDA      · el contenido se va por un lado
     2. ZONA DE PASO · solo cielo y nubes en parallax, en bucle, mientras se carga la
                      página nueva: su HTML, sus estilos, sus imágenes y su decoración
                      (los vídeos no cuentan). Como mucho --transicion-espera-max.
     3. ENTRADA     · el contenido nuevo llega frenando, ya con todo cargado
   La dirección del navegador cambia igual (y los botones atrás/adelante hacen el
   viaje al revés). Cada página sigue siendo un HTML normal que funciona por separado.
   Si algo falla (p. ej. abriendo los archivos sin servidor), se cambia de página de
   la forma normal y la página nueva continúa el viaje en su punto.

   Tipos de viaje:
     · "adelante" (por defecto: carteles, hojas...) → sale por la IZQUIERDA, entra por la DERECHA
     · "atras"    (.pf-back-btn)                    → al revés
     · "arriba"   (data-transicion="arriba")        → viaje a las estrellas (línea de tiempo)
     · "abajo"    (data-transicion="abajo")         → vuelta de las estrellas a las nubes
   Cualquier enlace puede forzar un tipo con data-transicion="..." o no hacer
   transición con data-transicion="no".
   Ajustes (velocidades, parallax...): variables --transicion-* de Css/styles.css.

   ⚠ Este script va en el <head> (antes del <body>): define pfPagina, que usan los demás.
   ============================================================ */

/* ============================================================
   pfPagina · CICLO DE VIDA DE CADA PÁGINA
   Como la web ya no recarga al cambiar de sección, cada script le dice aquí qué hacer
   al empezar una página y qué deja enganchado (para quitarlo al irse):
     pfPagina.alIniciar(fn)   fn se ejecuta al empezar CADA página (como DOMContentLoaded)
     pfPagina.alCargar(fn)    fn se ejecuta cuando han cargado las imágenes de la página
                              actual (como window "load"). Se usa DENTRO de alIniciar.
     pfPagina.escuchar(objeto, evento, fn, opciones)
                              addEventListener que se quita solo al cambiar de página
                              (para window, document, matchMedia...; lo que va en elementos
                              de la página no hace falta: se van con ella)
     pfPagina.observar(obs)   ResizeObserver / MutationObserver que se desconecta al irse
     pfPagina.alSalir(fn)     fn se ejecuta justo antes de cambiar de página
   ============================================================ */
var pfPagina = (function () {
    var arranques = [];                                   // para todas las páginas
    var cargas = [], escuchas = [], observadores = [], limpiezas = [];   // solo de la página actual
    var cargada = false, cambiada = false;
    function ejecutar(fn) { try { fn(); } catch (e) { console.error(e); } }

    var api = {
        alIniciar: function (fn) { arranques.push(fn); },
        alCargar: function (fn) {
            if (cargada) requestAnimationFrame(function () { ejecutar(fn); });
            else cargas.push(fn);
        },
        escuchar: function (objeto, evento, fn, opciones) {
            if (objeto.addEventListener) objeto.addEventListener(evento, fn, opciones);
            else if (objeto.addListener) objeto.addListener(fn);        // matchMedia de Safari antiguo
            escuchas.push([objeto, evento, fn, opciones]);
        },
        observar: function (obs) { observadores.push(obs); return obs; },
        alSalir: function (fn) { limpiezas.push(fn); },

        // (los usa la transición)
        arrancar: function () { cargada = false; arranques.forEach(ejecutar); },
        // Igual, pero cada script en su propio fotograma: así ninguno bloquea la animación
        // (el orden se mantiene). Devuelve una promesa que se cumple al acabar.
        arrancarPorPartes: function () {
            cargada = false;
            var lista = arranques.slice();
            return new Promise(function (listo) {
                (function siguiente() {
                    if (!lista.length) { listo(); return; }
                    ejecutar(lista.shift());
                    requestAnimationFrame(function () { setTimeout(siguiente, 0); });
                })();
            });
        },
        terminarCarga: function () { cargada = true; var l = cargas; cargas = []; l.forEach(ejecutar); },
        salir: function () {
            cambiada = true;
            escuchas.forEach(function (e) {
                if (e[0].removeEventListener) e[0].removeEventListener(e[1], e[2], e[3]);
                else if (e[0].removeListener) e[0].removeListener(e[2]);
            });
            observadores.forEach(function (o) { o.disconnect(); });
            limpiezas.forEach(ejecutar);
            cargas = []; escuchas = []; observadores = []; limpiezas = []; cargada = false;
        }
    };
    document.addEventListener("DOMContentLoaded", api.arrancar);
    window.addEventListener("load", function () { if (!cambiada) api.terminarCarga(); });
    return api;
})();

(function () {
    var CLAVE = "pf-transicion";      // viaje en curso, si hay que cambiar de página de la forma normal
    var CIELO = "pf-cielo";           // dónde está el cielo en reposo (en anchos de pantalla)
    var TIPOS = ["adelante", "atras", "arriba", "abajo"];
    var INVERSO = { adelante: "atras", atras: "adelante", arriba: "abajo", abajo: "arriba" };
    var DIRECCION = { adelante: [-1, 0], atras: [1, 0], arriba: [0, 1], abajo: [0, -1] };   // hacia dónde se va el contenido
    var raiz = document.documentElement;
    var reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function leer(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } }
    function guardar(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function borrar(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
    function css(nombre) { return getComputedStyle(raiz).getPropertyValue(nombre).trim(); }
    function numero(nombre, defecto) { var n = parseFloat(css(nombre)); return isNaN(n) ? defecto : n; }
    function segundos(nombre, defecto) {
        var v = css(nombre), n = parseFloat(v);
        return isNaN(n) ? defecto : /ms$/.test(v) ? n / 1000 : n;
    }
    function limitar(n) { return Math.max(0, Math.min(1, n)); }
    function px(x, y) { return x.toFixed(1) + "px " + y.toFixed(1) + "px"; }
    function esVertical(tipo) { return tipo === "arriba" || tipo === "abajo"; }
    function sinHash(url) { return url.split("#")[0]; }

    /* CIELO en reposo · donde lo dejó la última transición. x entre 0 y 2: la imagen se repite cada 2 pantallas */
    var cielo = leer(CIELO) || { x: 0, y: 0 };
    function ponerCielo(c) {
        cielo = c;
        raiz.style.setProperty("--pf-cielo-x", c.x);
        raiz.style.setProperty("--pf-cielo-y", c.y);
    }
    ponerCielo(cielo);

    /* HISTORIAL · cada página visitada lleva su número y con qué viaje se llegó a ella
       (para que "atrás" haga el viaje contrario) */
    var indice = 0, tipoActual = null;
    try {
        if (history.state && typeof history.state.pfIndice === "number") {
            indice = history.state.pfIndice; tipoActual = history.state.pfTipo || null;
        } else history.replaceState({ pfIndice: 0, pfTipo: null }, "");
        if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    } catch (e) {}
    var rutaActual = sinHash(location.href);
    var clasesPagina = (raiz.getAttribute("class") || "").split(/\s+/).filter(function (c) { return c && c.indexOf("pf-") !== 0; });

    /* ---------------------------------------------------------------------------
       EL VIAJE · v = { tipo, t0 (hora del clic), De (s que dura la salida),
                        Dn (s que dura la entrada), cielo (cielo al empezar, sin scroll) }
       ------------------------------------------------------------------------- */
    function crearViaje(tipo) {
        var vertical = esVertical(tipo);
        var total = segundos(vertical ? "--transicion-espacio-duracion" : "--transicion-lateral-duracion", vertical ? 2.6 : 1.1);
        // Lateral: ease-in (salida) + ease-out (entrada), mitad y mitad.
        // Espacio: velocidad constante (salida) + ease-out (entrada). Como la entrada arranca a la misma
        // velocidad que la salida y frena con una cúbica, tarda 3 veces más: salida = 1/4 del total.
        var De = vertical ? total / 4 : total / 2;
        return { tipo: tipo, t0: Date.now(), De: De, Dn: vertical ? total * 3 / 4 : total / 2,
                 cielo: { x: cielo.x, y: cielo.y - window.scrollY / window.innerWidth } };
    }

    /* RELOJ DEL VIAJE · avanza con los fotogramas, pero nunca más de 1/30 s de golpe.
       Si el navegador se queda un momento ocupado (montando la página nueva), el viaje
       espera ese momento en vez de dar un salto hacia delante. */
    var PASO_MAX = 1 / 30;
    function tiempo(ahora) {                                            // ahora = hora del fotograma (requestAnimationFrame)
        if (v.ultimo === undefined) {                                   // (la 1ª vez: lo que ya ha pasado desde el clic)
            v.reloj = Math.max(0, (Date.now() - v.t0) / 1000);
            v.ultimo = ahora === undefined ? performance.now() : ahora;
            return v.reloj;
        }
        if (ahora === undefined) return v.reloj;                        // (repintado fuera del bucle: no avanza)
        v.reloj += Math.min(PASO_MAX, Math.max(0, (ahora - v.ultimo) / 1000));
        v.ultimo = ahora;
        return v.reloj;
    }

    var v = null;            // viaje en curso
    var nueva = false;       // ¿el contenido que hay ya es el de la página nueva?
    var arrancada = false;   // ¿la página nueva ya ha montado su decoración (scripts)?
    var listo = false;       // ¿ha cargado todo lo de la página nueva?
    var te = null;           // segundo (desde t0) en que empieza la ENTRADA
    var modo = null;         // "interno" (se carga por dentro) o "recarga" (cambio de página normal)
    var preparada = null;    // página nueva ya cargada, lista para el cambio
    var cambiando = false;
    var ido = false;
    var destino = null;

    // Cuánto ha avanzado la "cámara" (en pantallas) en el segundo t del viaje
    function camara(t) {
        var vel = esVertical(v.tipo) ? 1 / v.De : 3 / v.De;          // velocidad de crucero
        if (t < v.De) return esVertical(v.tipo) ? t / v.De : Math.pow(t / v.De, 3);
        var x = 1 + vel * (t - v.De);
        if (te !== null && t >= te) {
            var s = limitar((t - te) / v.Dn);
            x = 1 + vel * (te - v.De) + (1 - Math.pow(1 - s, 3));     // entrada: ease-out desde la velocidad de crucero
        }
        return x;
    }
    // Altura en el viaje al espacio: 0 = nubes, 1 = estrellas. Sube poco a poco desde el principio
    // y tiene que estar ya casi en el color del espacio cuando aparece la línea de tiempo:
    // así su borde no se recorta contra un cielo claro.
    function altura(t) {
        function crucero(t) { return 0.5 + 0.4 * (1 - Math.exp(-(t - v.De) / 0.5)); }
        var a;
        if (t < v.De) a = 0.5 * (1 - Math.pow(1 - t / v.De, 1.4));      // (sale a toda velocidad)
        else if (te === null || t < te) a = crucero(t);
        else {
            var ae = crucero(te), s = limitar((t - te) / (v.Dn * 0.3));  // llega al espacio en el primer 30% de la entrada
            a = ae + (1 - ae) * (1 - Math.pow(1 - s, 2));
        }
        return v.tipo === "arriba" ? a : 1 - a;
    }

    function pintar(ahora) {
        var W = window.innerWidth, H = window.innerHeight;
        var t = tiempo(ahora);
        var d = DIRECCION[v.tipo], vertical = esVertical(v.tipo);
        var X = camara(t);
        var entrando = te !== null && t >= te;
        var s = entrando ? limitar((t - te) / v.Dn) : 0;

        // Contenido: el viejo se va (0 → 1 pantalla) · el nuevo espera fuera y llega (1 → 0)
        // (en lateral el nuevo ya está en su sitio: lo destapa el muro de nubes)
        var fuera = nueva ? (vertical ? (entrando ? Math.pow(1 - s, 3) : 1) : 0) : Math.min(1, X);
        var signo = nueva ? -1 : 1;                                     // el nuevo viene del lado contrario
        raiz.style.setProperty("--pf-t-mov", px(signo * d[0] * fuera * W, signo * d[1] * fuera * H));

        // Rapidez (0 = parado, 1 = crucero): para que las nubes de delante y las estelas
        // aparezcan al coger velocidad y se vayan al frenar
        var rapidez = entrando ? Math.pow(1 - s, 2) : t < v.De ? (vertical ? 1 : Math.pow(t / v.De, 2)) : 1;
        var aparecer = limitar(t / 0.25);                              // sin aparecer de golpe al arrancar

        if (!vertical) {
            // MURO DE NUBES · ancho = pantalla / núcleo (el núcleo opaco mide justo una pantalla).
            //   "adelante": entra por la derecha → tapa → se retira por la izquierda · "atras": al revés
            // Tapa en la salida (ease-in-out) y se retira en la entrada (ease-in-out), que empieza
            // cuando la sección nueva ha cargado entera.
            var muro = W / numero("--transicion-muro-nucleo", 0.56), borde = (muro - W) / 2;
            function suave(k) { return k * k * (3 - 2 * k); }
            var tapar = suave(limitar(t / v.De)), retirar = entrando ? suave(s) : 0;
            var x = d[0] < 0
                ? W + (-borde - W) * tapar + (-muro + borde) * retirar     // derecha → centro → izquierda
                : -muro + (muro - borde) * tapar + (W + borde) * retirar;  // izquierda → centro → derecha
            raiz.style.setProperty("--pf-t-muro", x.toFixed(1) + "px");
            raiz.style.setProperty("--pf-t-muro-ancho", muro.toFixed(1) + "px");
            raiz.style.setProperty("--pf-t-muro-borde", (borde - 1).toFixed(1) + "px");
            raiz.style.setProperty("--pf-t-muro-nucleo", (W + 2).toFixed(1) + "px");   // (+2: sin rendija en los bordes)
        } else {
            var a = altura(t), banda = numero("--transicion-espacio-degradado", 1.6) * 100;
            var m1 = a * (100 + banda);
            raiz.style.setProperty("--pf-t-fondo", px(0, d[1] * X * numero("--transicion-espacio-estrellas", 0.15) * H + window.scrollY));
            raiz.style.setProperty("--pf-t-capa1", px(v.cielo.x * W, v.cielo.y * W + d[1] * X * numero("--transicion-espacio-cielo", 0.6) * H));
            raiz.style.setProperty("--pf-t-mascara-0", (m1 - banda).toFixed(2) + "%");
            raiz.style.setProperty("--pf-t-mascara-1", m1.toFixed(2) + "%");
            raiz.style.setProperty("--pf-t-tinte", "rgb(10 22 80 / " + Math.min(0.8, a * 0.9).toFixed(3) + ")");
            // Degradado que cuelga del borde de abajo de la línea de tiempo (hasta su color):
            // al llegar va por delante oscureciendo el cielo; al irse se queda detrás y se apaga
            var conEstrellas = v.tipo === "arriba" ? nueva : !nueva;
            var borde = (signo * d[1] * fuera + 1) * H;                 // borde de abajo del contenido
            var alfa = 0;
            if (v.tipo === "arriba") alfa = entrando ? limitar(s / 0.08) : 0;
            else alfa = t < v.De ? 1 : 1 - limitar((t - v.De) / 0.4);
            if (!conEstrellas && v.tipo === "arriba") alfa = 0;
            raiz.style.setProperty("--pf-t-panel-borde", Math.max(0, borde).toFixed(1) + "px");
            raiz.style.setProperty("--pf-t-panel-alfa", alfa.toFixed(3));
            var e = d[1] * X * H;
            raiz.style.setProperty("--pf-t-capa3", px(0, e * 4) + ", " + px(40, e * 3) + ", " + px(90, e * 5));
            raiz.style.setProperty("--pf-t-estelas", (rapidez * aparecer * numero("--transicion-espacio-estelas", 0.55)).toFixed(3));
            raiz.style.setProperty("--pf-t-capa2", px(0.2 * W, -0.6 * W + d[1] * X * numero("--transicion-espacio-nubes-delante", 2.2) * H));
            raiz.style.setProperty("--pf-t-op2", (limitar(1 - a * 2) * Math.min(1, rapidez * 1.5) * aparecer).toFixed(3));
        }
        return { t: t, s: s, X: X };
    }

    function terminar(X) {
        // El cielo se queda donde ha llegado (así la siguiente transición sigue desde ahí)
        var W = window.innerWidth, H = window.innerHeight, d = DIRECCION[v.tipo], c;
        if (esVertical(v.tipo)) c = { x: v.cielo.x, y: v.cielo.y + d[1] * X * numero("--transicion-espacio-cielo", 0.6) * H / W };
        else c = { x: v.cielo.x, y: v.cielo.y };                       // (lateral: el cielo no se mueve; se pone al tapar)
        c.x = ((c.x % 2) + 2) % 2;
        ponerCielo(c);
        guardar(CIELO, c);
        quitar();
        fundirBarras();
    }

    /* BARRAS DE DESPLAZAMIENTO · durante el viaje son invisibles (Css/styles.css). Al llegar
       aparecen con un fundido: se tapan con una franja del color del fondo que se desvanece
       (--transicion-barras-fundido). Vale para las barras de los elementos (como la de la
       línea de tiempo); la de la página entera no se puede tapar y aparece sin más. */
    function fundirBarras() {
        var dur = segundos("--transicion-barras-fundido", 0.8);
        if (!(dur > 0)) return;
        var color = getComputedStyle(raiz).backgroundColor;
        document.querySelectorAll("body *").forEach(function (el) {
            var e = getComputedStyle(el);
            if (!/(auto|scroll)/.test(e.overflowX + e.overflowY)) return;
            var bl = parseFloat(e.borderLeftWidth), br = parseFloat(e.borderRightWidth);
            var bt = parseFloat(e.borderTopWidth), bb = parseFloat(e.borderBottomWidth);
            var horizontal = el.offsetHeight - el.clientHeight - bt - bb;    // grosor de la barra de abajo
            var vertical = el.offsetWidth - el.clientWidth - bl - br;        // grosor de la barra de la derecha
            if (horizontal < 1 && vertical < 1) return;
            var r = el.getBoundingClientRect();
            var franjas = [];
            if (horizontal >= 1) franjas.push([r.left + bl, r.bottom - bb - horizontal, r.width - bl - br, horizontal]);
            if (vertical >= 1) franjas.push([r.right - br - vertical, r.top + bt, vertical, r.height - bt - bb]);
            franjas.forEach(function (f) {
                var tapa = document.createElement("div");
                tapa.setAttribute("aria-hidden", "true");
                tapa.style.cssText = "position:fixed;z-index:95;pointer-events:none;left:" + f[0] + "px;top:" + f[1] +
                    "px;width:" + f[2] + "px;height:" + f[3] + "px;background:" + color + ";opacity:1;transition:opacity " + dur + "s ease-out";
                document.body.appendChild(tapa);
                requestAnimationFrame(function () { requestAnimationFrame(function () { tapa.style.opacity = "0"; }); });
                setTimeout(function () { tapa.remove(); }, dur * 1000 + 100);
            });
        });
    }
    function quitar() {
        v = null;
        raiz.classList.remove("pf-transicion", "pf-lateral", "pf-vertical");
        Array.prototype.slice.call(raiz.style).forEach(function (p) {
            if (p.indexOf("--pf-t-") === 0) raiz.style.removeProperty(p);
        });
    }

    function bucle(ahora) {
        if (!v) return;
        var e = pintar(ahora);
        if (nueva) {
            // Sale de la zona de paso cuando todo ha cargado (o al pasar el tiempo máximo)
            var espera = segundos("--transicion-espera-max", 2);
            if (te === null && arrancada && e.t >= v.De && (listo || e.t >= v.De + espera)) te = e.t;
            if (te !== null && e.s >= 1) { terminar(e.X); return; }
        } else if (e.t >= v.De) {                                       // el contenido viejo ya no se ve
            if (modo === "interno") {
                if (preparada && !cambiando) cambiar();
                else if (!preparada && e.t >= v.De + 8) recargar();       // no llega: cambio de página normal
            } else recargar();
        }
        requestAnimationFrame(bucle);
    }

    function empezar(viaje, esNueva) {
        v = viaje; nueva = esNueva; te = null; ido = false; listo = false; arrancada = false;
        cambiando = false; preparada = null;
        raiz.classList.remove("pf-lateral", "pf-vertical");
        raiz.classList.add("pf-transicion", esVertical(v.tipo) ? "pf-vertical" : "pf-lateral");
        pintar();                          // ya colocado antes de pintar nada
        requestAnimationFrame(bucle);
    }

    /* CAMBIO DE PÁGINA NORMAL (si no se puede por dentro) · la página nueva continúa el viaje */
    function recargar() {
        if (ido) return;
        ido = true;
        guardar(CLAVE, { tipo: v.tipo, t0: v.t0, De: v.De, Dn: v.Dn, cielo: v.cielo });
        if (!esVertical(v.tipo)) guardar(CIELO, v.cielo);                // (lateral: la página nueva sale ya con su cielo)
        location.href = destino;           // (esta sigue moviendo el cielo hasta que llega la otra)
    }

    /* ---------------------------------------------------------------------------
       CARGA POR DENTRO
       ------------------------------------------------------------------------- */
    var paginas = {};                                                   // url → promesa con su HTML
    function pedirHtml(url) {
        url = sinHash(url);
        if (!paginas[url]) {
            paginas[url] = fetch(url).then(function (r) {
                if (!r.ok) throw new Error("HTTP " + r.status);
                return r.text();
            });
            paginas[url].catch(function () { delete paginas[url]; });  // si falla, se podrá volver a pedir
        }
        return paginas[url];
    }

    var scriptsCargados = null;                                         // src de los scripts que ya se han ejecutado
    function cargarScripts(lista) {
        return lista.reduce(function (anterior, src) {
            return anterior.then(function () {
                if (scriptsCargados[src]) return;
                scriptsCargados[src] = true;
                return new Promise(function (listo) {
                    var s = document.createElement("script");
                    s.src = src;
                    s.onload = s.onerror = function () { listo(); };
                    document.body.appendChild(s);
                });
            });
        }, Promise.resolve());
    }

    function esperarImagen(img) {
        var carga = img.complete ? Promise.resolve() : new Promise(function (listo) {
            img.addEventListener("load", listo, { once: true });
            img.addEventListener("error", listo, { once: true });
        });
        return carga.then(function () { return img.decode ? img.decode().catch(function () {}) : null; });
    }

    // Prepara la página nueva SIN tocar la actual: su HTML, sus estilos (cargados pero
    // apagados) y su <body> (sus imágenes empiezan a cargar ya)
    function prepararPagina(url) {
        return pedirHtml(url).then(function (html) {
            var doc = new DOMParser().parseFromString(html, "text/html");
            // Rutas relativas → absolutas (la página nueva puede estar en otra carpeta)
            doc.querySelectorAll("[src], [href], [poster]").forEach(function (el) {
                ["src", "href", "poster"].forEach(function (a) {
                    var valor = el.getAttribute(a);
                    if (valor === null || /^(#|javascript:|mailto:|tel:|data:)/i.test(valor)) return;
                    try { el.setAttribute(a, new URL(valor, url).href); } catch (e) {}
                });
            });
            // Scripts: no se copian, se cargan aparte (solo los que no se hayan ejecutado ya)
            if (!scriptsCargados) {
                scriptsCargados = {};
                Array.prototype.forEach.call(document.scripts, function (s) { if (s.src) scriptsCargados[s.src] = true; });
            }
            var scripts = [];
            doc.querySelectorAll("script").forEach(function (s) {
                if (s.src) scripts.push(s.src);
                s.remove();
            });
            // Estilos: los que falten se cargan apagados (media="not all") hasta el cambio
            // (cada una en el MISMO orden que en su página: el orden decide qué regla gana)
            var actuales = Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]'));
            function actual(href) { return actuales.filter(function (a) { return a.href === href; })[0] || null; }
            var enLaNueva = Array.prototype.slice.call(doc.querySelectorAll('link[rel="stylesheet"]'));
            var hrefs = enLaNueva.map(function (l) { return l.href; });
            var nuevos = [], esperas = [];
            var alFinal = actuales[actuales.length - 1] || null;            // tras qué hoja van las que no tienen otra detrás
            enLaNueva.forEach(function (l, i) {
                if (actual(l.href)) return;
                var link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = l.href;
                link.media = "not all";
                link._pfMedia = l.getAttribute("media");
                ["integrity", "crossorigin"].forEach(function (a) { if (l.hasAttribute(a)) link.setAttribute(a, l.getAttribute(a)); });
                esperas.push(new Promise(function (listo) { link.onload = link.onerror = listo; setTimeout(listo, 5000); }));
                var siguiente = null;                                       // la primera hoja que ya está y va detrás de esta
                for (var j = i + 1; j < hrefs.length && !siguiente; j++) siguiente = actual(hrefs[j]);
                if (siguiente) document.head.insertBefore(link, siguiente);
                else {
                    if (alFinal) alFinal.parentNode.insertBefore(link, alFinal.nextSibling); else document.head.appendChild(link);
                    alFinal = link;
                }
                nuevos.push(link);
            });
            var body = document.importNode(doc.body, true);
            return Promise.all(esperas).then(function () {
                return {
                    url: url, body: body, scripts: scripts, titulo: doc.title,
                    lang: doc.documentElement.getAttribute("lang") || raiz.lang,
                    clases: (doc.documentElement.getAttribute("class") || "").split(/\s+/).filter(Boolean),
                    estilosNuevos: nuevos,
                    estilosFuera: actuales.filter(function (a) { return hrefs.indexOf(a.href) < 0; })
                };
            });
        });
    }

    // Espera a que esté listo lo que se ve: imágenes, decoración (fondos, bordes y máscaras
    // de los elementos y sus ::before/::after, también los que crean los scripts) y fuentes.
    // Los vídeos no cuentan.
    // (Se revisan los elementos a trozos, unos pocos milisegundos por fotograma, para no frenar la animación)
    function esperarRecursos() {
        var esperas = [], urls = {};
        document.querySelectorAll("body img").forEach(function (img) { esperas.push(esperarImagen(img)); });
        // (también el fondo de <html> y del <body>: la sección nueva no se destapa hasta tenerlo)
        var elementos = [raiz, document.body].concat(Array.prototype.slice.call(document.querySelectorAll("body *"))), i = 0;
        return new Promise(function (revisados) {
            (function trozo() {
                var hasta = performance.now() + 6;
                for (; i < elementos.length && performance.now() < hasta; i++) {
                    [null, "::before", "::after"].forEach(function (pseudo) {
                        var e = getComputedStyle(elementos[i], pseudo);
                        [e.backgroundImage, e.borderImageSource, e.maskImage || e.webkitMaskImage].forEach(function (valor) {
                            if (valor && valor !== "none") valor.replace(/url\(["']?([^"')]+)["']?\)/g, function (_, u) { urls[u] = true; });
                        });
                    });
                }
                if (i < elementos.length) requestAnimationFrame(trozo); else revisados();
            })();
        }).then(function () {
            Object.keys(urls).forEach(function (u) {
                var img = new Image();
                img.src = u;
                esperas.push(esperarImagen(img));
            });
            if (document.fonts && document.fonts.ready) esperas.push(document.fonts.ready);
            return Promise.all(esperas.map(function (p) { return Promise.resolve(p).catch(function () {}); }));
        });
    }
    function fotograma() { return new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 0); }); }); }

    // EL CAMBIO · con el contenido viejo ya fuera de la pantalla
    function cambiar() {
        cambiando = true;
        var p = preparada, viaje = v;
        pfPagina.salir();                                               // cada script quita lo suyo
        // <head>: título y estilos
        document.title = p.titulo;
        p.estilosNuevos.forEach(function (l) { if (l._pfMedia) l.media = l._pfMedia; else l.removeAttribute("media"); });
        p.estilosFuera.forEach(function (l) { l.remove(); });
        // <html>: sus clases propias (las pf-* son de los scripts) y el idioma
        clasesPagina.forEach(function (c) { raiz.classList.remove(c); });
        p.clases.forEach(function (c) { if (c.indexOf("pf-") !== 0) raiz.classList.add(c); });
        clasesPagina = p.clases.filter(function (c) { return c.indexOf("pf-") !== 0; });
        raiz.lang = p.lang;
        // <body>
        raiz.replaceChild(p.body, document.body);
        if (viaje.empujar) {
            indice += 1;
            try { history.pushState({ pfIndice: indice, pfTipo: viaje.tipo }, "", p.url); } catch (e) {}
            tipoActual = viaje.tipo;
        } else {
            indice = viaje.indice; tipoActual = viaje.tipoLlegada;
        }
        rutaActual = sinHash(p.url);
        window.scrollTo(0, 0);
        if (!esVertical(viaje.tipo)) ponerCielo({ x: viaje.cielo.x, y: viaje.cielo.y });   // (lateral: el fondo, ya en su sitio final)
        nueva = true;
        pintar();                                                       // el contenido nuevo, ya fuera de la pantalla
        // Scripts que falten → cada script monta su parte (uno por fotograma) → se espera a que
        // cargue todo. Repartido en fotogramas para que la animación no dé tirones.
        var sigue = function () { if (v !== viaje) throw "otro viaje"; };
        fotograma()
            .then(function () { sigue(); return cargarScripts(p.scripts); })
            .then(function () { sigue(); return pfPagina.arrancarPorPartes(); })
            .then(function () { sigue(); arrancada = true; return fotograma(); })   // (los palos se montan justo después)
            .then(function () { sigue(); return esperarRecursos(); })
            .then(function () { sigue(); pfPagina.terminarCarga(); return fotograma(); })
            .then(function () { sigue(); return fotograma(); })
            .then(function () { sigue(); listo = true; })
            .catch(function () {});
    }

    function irA(url, tipo, opciones) {
        destino = url;
        var viaje = crearViaje(tipo);
        viaje.empujar = opciones.empujar;
        viaje.indice = opciones.indice;
        viaje.tipoLlegada = opciones.tipoLlegada;
        empezar(viaje, false);
        modo = window.fetch && window.DOMParser ? "interno" : "recarga";
        if (modo === "interno") {
            prepararPagina(url).then(function (p) { if (v === viaje) preparada = p; })
                .catch(function () { if (v === viaje) modo = "recarga"; });
        }
    }

    /* 1. LLEGADA POR CAMBIO DE PÁGINA NORMAL · continúa el viaje en su punto */
    var viajeGuardado = leer(CLAVE);
    borrar(CLAVE);
    if (viajeGuardado && TIPOS.indexOf(viajeGuardado.tipo) >= 0 && !reducir && Date.now() - viajeGuardado.t0 < 15000) {
        empezar(viajeGuardado, true);
        document.addEventListener("DOMContentLoaded", function () { arrancada = true; });
        // ¿Listo? = imágenes y decoración cargadas (evento load: no espera a los vídeos),
        // fuentes listas y un par de fotogramas para que se coloquen palos, tablones...
        window.addEventListener("load", function () {
            var fuentes = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
            fuentes.then(function () {
                requestAnimationFrame(function () { requestAnimationFrame(function () { listo = true; }); });
            });
        });
    }

    /* 2. PRECARGA · al pasar el ratón (o el dedo) por un enlace se pide ya la página y sus
          imágenes: así la zona de paso suele durar muy poco */
    function esInterno(a) {
        if (a.target && a.target !== "_self") return false;
        if (a.hasAttribute("download") || a.dataset.transicion === "no") return false;
        var url = new URL(a.href, location.href);
        if (url.origin !== location.origin || !/(\.html?|\/)$/.test(url.pathname)) return false;
        return !(url.pathname === location.pathname && url.hash);      // ancla en la misma página
    }
    function enlace(e) {
        var a = e.target.closest && e.target.closest("a[href]");
        return a && esInterno(a) ? a : null;
    }
    var precargadas = {};
    function precargar(a) {
        var url = sinHash(a.href);
        if (precargadas[url] || !window.fetch || !window.DOMParser) return;
        precargadas[url] = true;
        pedirHtml(url).then(function (html) {
            var doc = new DOMParser().parseFromString(html, "text/html");
            doc.querySelectorAll("img[src]").forEach(function (img) {
                new Image().src = new URL(img.getAttribute("src"), url).href;
            });
        }).catch(function () { delete precargadas[url]; });
    }
    // Las imágenes de las capas del viaje (nubes sueltas, estrellas...) se piden al abrir
    // la web: si no, la primera vez aparecerían de golpe a mitad del viaje.
    // (Sus url() son relativas a Css/styles.css.)
    document.addEventListener("DOMContentLoaded", function () {
        var hoja = document.querySelector('link[rel="stylesheet"][href*="styles.css"]');
        if (!hoja || reducir) return;
        ["--transicion-cielo-img", "--transicion-nubes-img", "--transicion-estrellas-img", "--transicion-muro-img"].forEach(function (nombre) {
            var m = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(css(nombre));
            if (m) new Image().src = new URL(m[1], hoja.href).href;
        });
    });
    ["pointerover", "focusin", "touchstart"].forEach(function (evento) {
        document.addEventListener(evento, function (e) {
            var a = enlace(e);
            if (a && !reducir) precargar(a);
        }, { passive: true });
    });

    /* 3. CLIC EN UN ENLACE · empieza el viaje */
    document.addEventListener("click", function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = enlace(e);
        if (!a || reducir) return;
        e.preventDefault();
        if (v) return;                                                  // ya hay un viaje en marcha
        var pedido = a.dataset.transicion;
        var tipo = TIPOS.indexOf(pedido) >= 0 ? pedido : a.classList.contains("pf-back-btn") ? "atras" : "adelante";
        precargar(a);
        irA(a.href, tipo, { empujar: true });
    });

    /* 4. BOTONES ATRÁS / ADELANTE DEL NAVEGADOR · el mismo viaje (al revés si se vuelve) */
    window.addEventListener("popstate", function (e) {
        if (sinHash(location.href) === rutaActual) return;              // solo ha cambiado el #ancla
        var estado = e.state || {};
        if (v || reducir || typeof estado.pfIndice !== "number") { location.reload(); return; }
        var atras = estado.pfIndice < indice;
        var tipo = atras ? (INVERSO[tipoActual] || "atras") : (estado.pfTipo || "adelante");
        irA(location.href, tipo, { empujar: false, indice: estado.pfIndice, tipoLlegada: estado.pfTipo || null });
    });

    // Mientras dura, la rueda no mueve la página (se registra antes que el scroll suave)
    window.addEventListener("wheel", function (e) {
        if (v) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, { passive: false, capture: true });

    /* 5. Volver con "atrás" tras un cambio de página normal: la página sale de la caché tal
          cual se quedó (a mitad de viaje). Se devuelve a su sitio, con su cielo. */
    window.addEventListener("pageshow", function (e) {
        if (!e.persisted) return;
        var c = cielo;
        quitar();
        borrar(CLAVE);
        ponerCielo(c);
        guardar(CIELO, c);
    });
})();
