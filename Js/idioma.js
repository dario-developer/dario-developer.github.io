/* ============================================================
   idioma.js · traduce la web entre ESPAÑOL (el del HTML) e INGLÉS
   ─ El HTML siempre está escrito en español. Este script cambia cada texto por su
     traducción del diccionario de abajo (y los atributos alt / title / aria-label).
   ─ El idioma elegido se guarda en el navegador: se mantiene al cambiar de página.
   ─ Botones: cualquier elemento con data-idioma="es" o data-idioma="en" (en el index,
     las banderas). Si ya está en ese idioma, no hace nada.
   ─ Los textos que se crean después (ej. el botón "Cara A / Cara B" de la línea de
     tiempo) también se traducen solos.

   PARA AÑADIR TEXTOS: añade una línea "texto en español": "English text" al diccionario.
   Los textos se comparan sin tener en cuenta espacios ni saltos de línea de más.
   Un texto que no esté en el diccionario se queda en español (ej. el Lorem ipsum).
   ============================================================ */
var PF_TRADUCCIONES = {
    /* --- Comunes --- */
    "Portfolio Darío Navarro": "Darío Navarro's Portfolio",
    "Sobre mi": "About me",
    "Proyectos": "Projects",
    "Linea de tiempo": "Timeline",
    "CV": "CV",
    "Mi logo": "My logo",
    "Volver al inicio": "Back to home",
    "Anterior": "Previous",
    "Siguiente": "Next",
    "Imagen sobre mí": "About me image",
    "Imagen proyectos": "Projects image",
    "Imagen línea de tiempo": "Timeline image",
    "Imagen CV": "CV image",
    "Imagen de galería 1": "Gallery image 1",
    "Imagen de galería 2": "Gallery image 2",
    "Imagen de galería 3": "Gallery image 3",
    "Imagen de galería 4": "Gallery image 4",
    "Idioma": "Language",
    "Español": "Spanish",
    "Inglés": "English",
    "Cambiar a español": "Switch to Spanish",
    "Cambiar a inglés": "Switch to English",

    /* --- Sobre mí --- */
    "Imagen de Darío": "Picture of Darío",
    "Bienvenido a mi portfolio. Soy Darío, un Game Designer con pasión por los videojuegos y un torrente imparable de creatividad. Me llena crear experiencias atrevidas que desafían las normas establecidas, especialmente si las uno con elementos poco convencionales de otras disciplinas, como las matemáticas o el teatro. Soy una persona tranquila y constante con sus proyectos que busca potenciar lo mejor de cada experiencia.":
        "Welcome to my portfolio. I'm Darío, a Game Designer with a passion for video games and an unstoppable flood of creativity. I love creating bold experiences that challenge established norms, especially when I combine them with unconventional elements from other disciplines, such as mathematics or theatre. I'm a calm person who is consistent with his projects and always seeks to bring out the best in every experience.",
    "Actualmente busco empleo de Junior Game Designer o Junior Producer. Previamente he trabajado como Game y Level Designer y Producer en el equipo":
        "I'm currently looking for a job as a Junior Game Designer or Junior Producer. I have previously worked as a Game and Level Designer and Producer in the team",
    "y he creado múltiples proyectos personales que podrás encontrar en mi":
        "and I have created multiple personal projects that you can find on my",
    "También trabajo de profesor de diseño de videojuegos o de programación en campamentos de verano y extrascolares con alumnos de 8 a 16 años en":
        "I also work as a game design and programming teacher at summer camps and after-school activities with students aged 8 to 16 at",
    "o": "or",
    "Cuando no estoy diseñando videojuegos me puedes encontrar haciendo teatro en":
        "When I'm not designing video games you can find me doing theatre at",
    ", jugando títulos como Disco Elysium, Celeste o The Binding Of Isaac o participando en partidas de Dragones y Mazmorras. Creo videojuegos desde los 14 años (desde los 20 de manera profesional) y no tengo intención de parar pronto.":
        ", playing games like Disco Elysium, Celeste or The Binding Of Isaac, or taking part in Dungeons & Dragons sessions. I've been making video games since I was 14 (professionally since I was 20) and I have no intention of stopping any time soon.",

    /* --- Proyectos --- */
    "Proyecto 3": "Project 3",
    "Proyecto 4": "Project 4",
    "Imagen de Flipper on recoil": "Flipper on recoil image",
    "Imagen de Celtic trail": "Celtic trail image",
    "Imagen del proyecto 3": "Project 3 image",
    "Imagen del proyecto 4": "Project 4 image",
    "Plantilla proyecto": "Project template",
    "Plantilla proyectos": "Project template",

    /* --- Línea de tiempo --- */
    "1º bachillerato": "1st year of Sixth Form",
    "2º bachillerato": "2nd year of Sixth Form",
    "1º carrera": "1st year of degree",
    "2º carrera": "2nd year of degree",
    "3º carrera": "3rd year of degree",
    "4º carrera": "4th year of degree",
    "Busqueda de empleo": "Job search",
    "Estudio C1 de inglés": "C1 English studies",
    "Monitor en Camp Tecnológico": "Instructor at Camp Tecnológico",
    "Monitor en VIVO": "Instructor at VIVO",
    "Prácticas en el CSIC": "Internship at CSIC",
    "Prácticas monitor ocio y tiempo libre": "Youth leader placement",
    "Teórico monitor ocio y tiempo libre": "Youth leader course (theory)",
    "Trabajo en Chomperz": "Working at Chomperz",
    "Trabajo monitor Camp Tecnológico": "Instructor job at Camp Tecnológico",
    "Trabajo monitor logiscool": "Instructor job at Logiscool",
    "Trabajo profesor extraescolar Unity": "After-school Unity teacher",
    "Trabajo profesor particular": "Private tutor",
    "Voluntariado asociación \"de tu mano\"": "Volunteering at the \"de tu mano\" association",
    "Voluntariado residencia de ancianos": "Volunteering at a care home",
    "Cara A": "Side A",
    "Cara B": "Side B"
};

(function () {
    var CLAVE = "pf-idioma";
    var ATRIBUTOS = ["alt", "title", "aria-label"];
    var ignorar = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1 };
    function normalizar(t) { return t.replace(/\s+/g, " ").trim(); }

    // Diccionario normalizado (las claves pueden venir con saltos de línea del HTML)
    var aIngles = {}, aEspanol = {};
    Object.keys(PF_TRADUCCIONES).forEach(function (es) {
        var n = normalizar(es); aIngles[n] = PF_TRADUCCIONES[es]; aEspanol[normalizar(PF_TRADUCCIONES[es])] = n;
    });

    var idioma = "es", cambiando = false;
    try { idioma = localStorage.getItem(CLAVE) === "en" ? "en" : "es"; } catch (e) {}

    // Traduce un texto conservando los espacios de los bordes (para no pegar palabras a los enlaces)
    function traducir(texto, dic) {
        var n = normalizar(texto);
        if (!n || !(n in dic)) return null;
        var ini = /^\s/.test(texto) ? " " : "", fin = /\s$/.test(texto) ? " " : "";
        return ini + dic[n] + fin;
    }

    function aplicar(raiz) {
        var dic = idioma === "en" ? aIngles : aEspanol;
        // Textos
        var w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
            acceptNode: function (n) { return n.parentNode && ignorar[n.parentNode.nodeName] ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
        });
        var nodos = []; while (w.nextNode()) nodos.push(w.currentNode);
        nodos.forEach(function (n) { var t = traducir(n.nodeValue, dic); if (t !== null && t !== n.nodeValue) n.nodeValue = t; });
        // Atributos
        if (raiz.querySelectorAll) {
            var els = Array.prototype.slice.call(raiz.querySelectorAll("[alt],[title],[aria-label],[data-nombre]"));
            if (raiz.nodeType === 1) els.push(raiz);
            els.forEach(function (el) {
                ATRIBUTOS.concat(["data-nombre"]).forEach(function (a) {
                    if (!el.hasAttribute || !el.hasAttribute(a)) return;
                    var v = el.getAttribute(a), t = traducir(v, dic);
                    if (t !== null && t !== v) el.setAttribute(a, t);
                    // aria-label compuesto del botón de volteo: "Ver X (ahora: Y)" / "Show X (now: Y)"
                    if (a === "aria-label") {
                        var m = /^(Ver|Show) (.+) \((ahora|now): (.+)\)$/.exec(v);
                        if (m) {
                            var x = traducir(m[2], dic) || m[2], y = traducir(m[4], dic) || m[4];
                            el.setAttribute(a, idioma === "en" ? "Show " + x + " (now: " + y + ")" : "Ver " + x + " (ahora: " + y + ")");
                        }
                    }
                });
            });
        }
    }

    function aplicarTodo() {
        document.documentElement.lang = idioma;
        var t = traducir(document.title, idioma === "en" ? aIngles : aEspanol);
        if (t !== null) document.title = t;
        aplicar(document.body);
        document.querySelectorAll("[data-idioma]").forEach(function (b) {
            var activo = b.dataset.idioma === idioma;
            b.classList.toggle("activo", activo);
            b.setAttribute("aria-pressed", activo ? "true" : "false");
        });
    }

    // API por si otro script lo necesita: pfIdioma() → "es"/"en" · pfIdioma("en") → cambia
    window.pfIdioma = function (nuevo) {
        if (nuevo === undefined) return idioma;
        if (nuevo !== "es" && nuevo !== "en") return idioma;
        if (nuevo === idioma) return idioma;              // ya está en ese idioma: no hace nada
        idioma = nuevo;
        try { localStorage.setItem(CLAVE, idioma); } catch (e) {}
        aplicarTodo();
        return idioma;
    };

    document.addEventListener("DOMContentLoaded", function () {
        document.addEventListener("click", function (e) {
            var b = e.target.closest && e.target.closest("[data-idioma]");
            if (!b) return;
            e.preventDefault();
            var nuevo = b.dataset.idioma;
            if (nuevo === idioma || cambiando) return;     // ya está en ese idioma (o a mitad de un cambio): nada
            // Fundido: los textos se desvanecen, se traducen y vuelven a aparecer
            var raiz = document.documentElement;
            var ms = parseFloat(getComputedStyle(raiz).getPropertyValue("--idioma-fade")) * 1000;
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !(ms > 0)) { window.pfIdioma(nuevo); return; }
            // Solo se funden los elementos cuyo texto VA A CAMBIAR (ej. el nombre, que es igual
            // en los dos idiomas, se queda quieto)
            var dic = nuevo === "en" ? aIngles : aEspanol;
            var cambian = [];
            var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            while (w.nextNode()) {
                var n = w.currentNode, el = n.parentNode;
                if (!el || ignorar[el.nodeName]) continue;
                var t = traducir(n.nodeValue, dic);
                if (t !== null && normalizar(t) !== normalizar(n.nodeValue) && cambian.indexOf(el) < 0) cambian.push(el);
            }
            cambiando = true;
            cambian.forEach(function (el) { el.classList.add("pf-idioma-cambia"); });
            raiz.classList.add("pf-idioma-fundido", "pf-idioma-saliendo");
            setTimeout(function () {
                window.pfIdioma(nuevo);
                raiz.classList.remove("pf-idioma-saliendo");
                setTimeout(function () {
                    raiz.classList.remove("pf-idioma-fundido");
                    cambian.forEach(function (el) { el.classList.remove("pf-idioma-cambia"); });
                    cambiando = false;
                }, ms);
            }, ms);
        });
        aplicarTodo();
        // Lo que se añada o cambie después (otros scripts) también se traduce
        var pendiente = false;
        new MutationObserver(function () {
            if (pendiente || idioma === "es") return;
            pendiente = true;
            requestAnimationFrame(function () { pendiente = false; aplicar(document.body); });
        }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS.concat(["data-nombre"]) });
    });
})();
