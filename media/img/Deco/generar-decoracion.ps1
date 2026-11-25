# Monta las piezas de decoración que usa la web a partir de los dibujos (lienzo 3000x3000):
#
#   Cartel/tablon/tiras/tablon-N.png  tablón CLARO que sujeta el cartel de cabecera   (extremo | tramo central | extremo)
#   Cartel/placa/tiras/placa-N.png    placa OSCURA con clavos que enmarca el título    (extremo | tramo central | extremo)
#   Palo/tiras/punta-N.png            palo: extremo de arriba (N = variante)
#   Palo/tiras/tramo.png              palo: tramo que se repite hacia abajo
#   Suelo/tiras/cesped.png            césped del footer (se repite a lo ancho)
#   Hojas/foto/recortes/lado-2.png    2º lado de las hojas de foto
#   Cielo/tiras/nubes.png             cielo de nubes + su espejo (empalma también a los lados)
#
# Para que NO se note el salto entre piezas al azar:
#   · Cartel: el tramo central se repite a lo ancho; se escoge dónde empieza y acaba para que
#     casen entre sí (al repetirse) y con los dos extremos. Cada extremo se sube/baja lo justo
#     para que sus bordes de arriba y abajo coincidan con los del tramo.
#     Cada pieza vale para los dos lados (en espejo) y solo se combinan extremos DISTINTOS
#     (un cartel nunca sale simétrico).
#   · Palo: el tramo se corta por donde sus bordes coinciden arriba y abajo (se repite sin
#     escalón) y la punta se corta justo donde empalma con el tramo.
#   · Césped: se monta con su espejo al lado (A + A en espejo), así empalma consigo mismo.
#
# Uso (desde la raíz del proyecto, en Windows PowerShell):
#   & "media/img/Deco/generar-decoracion.ps1"
# Al final imprime los números que van en Css/styles.css (--cartel-*, --palo-*).
# Para añadir variantes: deja más piezas con el siguiente número (izquierda-3, centro-3, punta-3...)
# en el mismo lienzo y posición, y vuelve a ejecutarlo.
param([string]$preview = "")
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$raiz = $PSScriptRoot

# ---------------------------------------------------------------- utilidades
function Cargar($ruta){ $b = New-Object System.Drawing.Bitmap $ruta; $b.SetResolution(96,96); $b }
function Crop($b, $x, $y, $w, $h){ $r = New-Object System.Drawing.Rectangle $x,$y,$w,$h; $c = $b.Clone($r, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb); $c.SetResolution(96,96); $c }
function Espejo($b){ $c = $b.Clone(); $c.RotateFlip('RotateNoneFlipX'); $c }
function Lienzo($w, $h){ $b = New-Object System.Drawing.Bitmap $w,$h,([System.Drawing.Imaging.PixelFormat]::Format32bppArgb); $b.SetResolution(96,96); $b }
function Put($g, $img, $x, $y){ $g.DrawImage($img, (New-Object System.Drawing.Rectangle $x,$y,$img.Width,$img.Height), 0,0,$img.Width,$img.Height, [System.Drawing.GraphicsUnit]::Pixel) }
function NewG($bmp){ $g = [System.Drawing.Graphics]::FromImage($bmp); $g.InterpolationMode='NearestNeighbor'; $g.PixelOffsetMode='Half'; $g.CompositingMode='SourceCopy'; $g }
function Bytes($b){
    $r = New-Object System.Drawing.Rectangle 0,0,$b.Width,$b.Height
    $d = $b.LockBits($r, 'ReadOnly', 'Format32bppArgb')
    $a = New-Object byte[] ($d.Stride * $b.Height)
    [Runtime.InteropServices.Marshal]::Copy($d.Scan0, $a, 0, $a.Length); $b.UnlockBits($d)
    @{ px = $a; stride = $d.Stride; w = $b.Width; h = $b.Height }
}
# Guarda escalado (k = 0.4 → 40% del tamaño) con buena calidad
function GuardarEscalado($b, $k, $ruta){
    $w = [int][math]::Round($b.Width * $k); $h = [int][math]::Round($b.Height * $k)
    $o = Lienzo $w $h; $g = [System.Drawing.Graphics]::FromImage($o)
    $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingMode = 'SourceCopy'
    $at = New-Object System.Drawing.Imaging.ImageAttributes; $at.SetWrapMode('TileFlipXY')
    $g.DrawImage($b, (New-Object System.Drawing.Rectangle 0,0,$w,$h), 0,0,$b.Width,$b.Height, [System.Drawing.GraphicsUnit]::Pixel, $at)
    $g.Dispose(); New-Item -ItemType Directory -Force (Split-Path $ruta) | Out-Null
    $o.Save($ruta, [System.Drawing.Imaging.ImageFormat]::Png); $o.Dispose()
    Write-Host "   $([IO.Path]::GetFileName((Split-Path $ruta)))/$([IO.Path]::GetFileName($ruta))  ($w x $h)"
}
# Silueta por COLUMNAS (piezas horizontales): primera y última fila opaca de cada columna
function SiluetaCols($o, $y0, $y1){
    $t = New-Object int[] $o.w; $bt = New-Object int[] $o.w
    for ($x = 0; $x -lt $o.w; $x++) {
        $t[$x] = -1; $bt[$x] = -1
        for ($y = $y0; $y -lt $y1; $y++) { if ($o.px[$y * $o.stride + $x * 4 + 3] -gt 128) { $t[$x] = $y; break } }
        if ($t[$x] -ge 0) { for ($y = $y1 - 1; $y -ge $y0; $y--) { if ($o.px[$y * $o.stride + $x * 4 + 3] -gt 128) { $bt[$x] = $y; break } } }
    }
    @{ top = $t; bot = $bt }
}
# Silueta por FILAS (piezas verticales): primera y última columna opaca de cada fila
function SiluetaFilas($o, $x0, $x1){
    $l = New-Object int[] $o.h; $r = New-Object int[] $o.h
    for ($y = 0; $y -lt $o.h; $y++) {
        $l[$y] = -1; $r[$y] = -1
        for ($x = $x0; $x -lt $x1; $x++) { if ($o.px[$y * $o.stride + $x * 4 + 3] -gt 128) { $l[$y] = $x; break } }
        if ($l[$y] -ge 0) { for ($x = $x1 - 1; $x -ge $x0; $x--) { if ($o.px[$y * $o.stride + $x * 4 + 3] -gt 128) { $r[$y] = $x; break } } }
    }
    @{ l = $l; r = $r }
}
function Extension($s){ $a = -1; $b = -1; for ($i = 0; $i -lt $s.top.Length; $i++) { if ($s.top[$i] -ge 0) { if ($a -lt 0) { $a = $i }; $b = $i } }; @($a, $b) }

# ---------------------------------------------------------------- CARTEL (tablón y placa)
# Monta todas las combinaciones de extremos distintos × tramos centrales de un tipo de tablón.
#   $S = ancho (px del lienzo) que se queda cada extremo; $k = escala de salida
function MontarTablonHorizontal($carpeta, $nombreSalida, $S, $k){
    $piezas = Join-Path $carpeta "piezas"; $tiras = Join-Path $carpeta "tiras"
    New-Item -ItemType Directory -Force $tiras | Out-Null
    Get-ChildItem $tiras -Filter "$nombreSalida-*.png" -ErrorAction SilentlyContinue | Remove-Item
    $Y0 = 600; $Y1 = 2400                                 # franja del lienzo donde están dibujados

    function Pieza($bmp, $nombre, $origen){ $o = Bytes $bmp; $s = SiluetaCols $o $Y0 $Y1; $e = Extension $s
        @{ bmp = $bmp; nombre = $nombre; origen = $origen; sil = $s; x0 = $e[0]; x1 = $e[1] } }
    function PiezaEspejo($p, $nombre){            # la misma pieza volteada (su silueta, al revés)
        $t = $p.sil.top.Clone(); [Array]::Reverse($t); $b = $p.sil.bot.Clone(); [Array]::Reverse($b)
        $w = $t.Length
        @{ bmp = (Espejo $p.bmp); nombre = $nombre; origen = $p.origen; sil = @{ top = $t; bot = $b }; x0 = $w - 1 - $p.x1; x1 = $w - 1 - $p.x0 } }
    $izqs = @(); $ders = @(); $cens = @()
    foreach ($n in 1..9) {
        $f = Join-Path $piezas "izquierda-$n.png"
        if (Test-Path $f) { $p = Pieza (Cargar $f) "izquierda-$n" "i$n"; $izqs += $p; $ders += PiezaEspejo $p "izquierda-$n (espejo)" }
        $f = Join-Path $piezas "derecha-$n.png"
        if (Test-Path $f) { $p = Pieza (Cargar $f) "derecha-$n" "d$n"; $ders += $p; $izqs += PiezaEspejo $p "derecha-$n (espejo)" }
        $f = Join-Path $piezas "centro-$n.png"
        if (Test-Path $f) { $cens += Pieza (Cargar $f) "centro-$n" "c$n" }
    }
    Write-Host "$([IO.Path]::GetFileName($carpeta)): $($izqs.Count) extremos izq., $($ders.Count) der., $($cens.Count) centros"

    # Alto común (todas las tiras de este tipo miden lo mismo): lo que ocupan los centros + margen
    $ya = 9999; $yb = 0
    foreach ($c in $cens) { for ($x = $c.x0; $x -le $c.x1; $x += 7) { if ($c.sil.top[$x] -ge 0) { $ya = [math]::Min($ya, $c.sil.top[$x]); $yb = [math]::Max($yb, $c.sil.bot[$x]) } } }
    $ya -= 40; $yb += 40; $H = $yb - $ya

    # Coste de juntar la columna xa de la pieza A (subida/bajada dy) con la columna xb de B
    function Encaje($A, $xa, $B, $xb){
        $ta = $A.sil.top[$xa]; $ba = $A.sil.bot[$xa]; $tb = $B.sil.top[$xb]; $bb = $B.sil.bot[$xb]
        if ($ta -lt 0 -or $tb -lt 0) { return @(9999, 0) }
        $dy = [int][math]::Round((($tb - $ta) + ($bb - $ba)) / 2)
        @(([math]::Abs($ta + $dy - $tb) + [math]::Abs($ba + $dy - $bb)), $dy)
    }

    # Cada extremo se puede cortar a un ancho distinto (de $S[0] a $S[1] px desde su punta):
    # para cada columna del tramo central se busca el ancho de extremo que mejor casa con ella.
    function MejorCorteExtremo($P, $esIzq, $C, $cx){
        $m = $null
        for ($an = $S[0]; $an -le $S[1]; $an += 10) {
            $xp = $(if ($esIzq) { $P.x0 + $an - 1 } else { $P.x1 - $an + 1 })
            $e = Encaje $P $xp $C $cx
            if ($null -eq $m -or $e[0] -lt $m[0]) { $m = @($e[0], $cx, $e[1], $an) }
        }
        ,$m                                                          # @(coste, columna del tramo, dy, ancho del extremo)
    }

    $variantes = @(); $n = 0
    foreach ($L in $izqs) { foreach ($R in $ders) {
        if ($L.origen -eq $R.origen) { continue }                   # el mismo dibujo a los dos lados = simétrico
        foreach ($C in $cens) {
            $c0min = $C.x0 + 30; $c1max = $C.x1 - 30
            # Inicios (c0) del tramo con su mejor extremo izq. y finales (c1) con su mejor extremo der.
            $ini = @(); for ($cx = $c0min; $cx -le $c0min + 900; $cx += 4) { $ini += ,(MejorCorteExtremo $L $true $C $cx) }
            $fin = @(); for ($cx = $c1max; $cx -ge $c1max - 900; $cx -= 4) { $fin += ,(MejorCorteExtremo $R $false $C $cx) }
            # Se prueban TODAS las parejas: cuenta el total (extremos + que el tramo se repita sin salto)
            $mejor = $null
            foreach ($i in $ini) { foreach ($f in $fin) {
                if ($f[1] - $i[1] -lt 600) { continue }
                $t = [math]::Abs($C.sil.top[$f[1]] - $C.sil.top[$i[1]]) + [math]::Abs($C.sil.bot[$f[1]] - $C.sil.bot[$i[1]])
                $coste = $i[0] + $f[0] + $t
                if ($null -eq $mejor -or $coste -lt $mejor[0]) { $mejor = @($coste, $i, $f, $t) }
            } }
            $c0 = $mejor[1][1]; $c1 = $mejor[2][1]; $T = $c1 - $c0 + 1
            $dyL = $mejor[1][2]; $dyR = $mejor[2][2]                # cuánto bajar cada extremo para casar con el tramo
            $sL = $mejor[1][3]; $sR = $mejor[2][3]                  # ancho de cada extremo
            $n++
            $W = $sL + $T + $sR
            $o = Lienzo $W $H; $g = NewG $o
            Put $g (Crop $L.bmp $L.x0 ($ya - $dyL) $sL $H) 0 0
            Put $g (Crop $C.bmp $c0 $ya $T $H) $sL 0
            Put $g (Crop $R.bmp ($R.x1 - $sR + 1) ($ya - $dyR) $sR $H) ($sL + $T) 0
            $g.Dispose()
            GuardarEscalado $o $k (Join-Path $tiras "$nombreSalida-$n.png")
            Write-Host "      = $($L.nombre) ($sL px) + $($C.nombre) [$c0..$c1] + $($R.nombre) ($sR px)   (saltos: izq $($mejor[1][0]) px, der $($mejor[2][0]) px, al repetirse $($mejor[3]) px)"
            $o.Dispose()
            $variantes += @{ n = $n; izq = [math]::Round($sL * $k); der = [math]::Round($sR * $k) }
        }
    } }
    @{ variantes = $variantes; H = [math]::Round($H * $k) }
}

# ---------------------------------------------------------------- PALO
function MontarPalo($k){
    $piezas = Join-Path $raiz "Palo/piezas"; $tiras = Join-Path $raiz "Palo/tiras"
    New-Item -ItemType Directory -Force $tiras | Out-Null
    Get-ChildItem $tiras -Filter "*.png" -ErrorAction SilentlyContinue | Remove-Item
    $X0 = 530; $X1 = 906                                    # columnas del lienzo donde está el palo (544-892 + margen)
    $tb = Cargar (Join-Path $piezas "tramo.png"); $to = Bytes $tb; $ts = SiluetaFilas $to $X0 $X1
    # Tramo que se repite: filas y0..y1 cuyos bordes coinciden (lo de abajo casa con lo de arriba)
    $mejor = $null
    for ($y0 = 40; $y0 -le 700; $y0 += 3) { for ($y1 = $y0 + 1600; $y1 -le 2960; $y1 += 3) {
        if ($ts.l[$y0] -lt 0 -or $ts.l[$y1] -lt 0) { continue }
        $c = [math]::Abs($ts.l[$y0] - $ts.l[$y1]) + [math]::Abs($ts.r[$y0] - $ts.r[$y1])
        if ($null -eq $mejor -or $c -lt $mejor[0]) { $mejor = @($c, $y0, $y1) }
    } }
    $ty0 = $mejor[1]; $ty1 = $mejor[2]
    $tramo = Crop $tb $X0 $ty0 ($X1 - $X0) ($ty1 - $ty0)
    Write-Host "palo: tramo filas $ty0..$ty1 (salto al repetirse: $($mejor[0]) px)"
    GuardarEscalado $tramo $k (Join-Path $tiras "tramo.png")
    $altoTramo = [math]::Round(($ty1 - $ty0) * $k)
    # Puntas: desde arriba del dibujo hasta la fila que mejor casa con el principio del tramo
    $puntas = 0; $altoPunta = 0
    foreach ($n in 1..9) {
        $f = Join-Path $piezas "punta-$n.png"; if (-not (Test-Path $f)) { continue }
        $pb = Cargar $f; $po = Bytes $pb; $ps = SiluetaFilas $po $X0 $X1
        $arriba = 0; for ($y = 0; $y -lt $po.h; $y++) { if ($ps.l[$y] -ge 0) { $arriba = $y; break } }
        $mj = $null
        for ($y = $arriba + 500; $y -le 2950; $y += 2) {
            if ($ps.l[$y] -lt 0) { continue }
            $c = [math]::Abs($ps.l[$y] - $ts.l[$ty0]) + [math]::Abs($ps.r[$y] - $ts.r[$ty0])
            if ($null -eq $mj -or $c -lt $mj[0]) { $mj = @($c, $y) }
        }
        # Todas las puntas con el MISMO alto (más fácil en el CSS): el de la primera
        $ini = $arriba - 8
        if ($puntas -eq 0) { $altoPuntaLienzo = $mj[1] - $ini } else { $ini = $mj[1] - $altoPuntaLienzo }
        $punta = Crop $pb $X0 $ini ($X1 - $X0) ($mj[1] - $ini)
        $puntas++
        GuardarEscalado $punta $k (Join-Path $tiras "punta-$n.png")
        Write-Host "      punta-${n}: filas $ini..$($mj[1]) (salto con el tramo: $($mj[0]) px)"
    }
    @{ n = $puntas; W = [math]::Round(($X1 - $X0) * $k); HP = [math]::Round($altoPuntaLienzo * $k); HT = $altoTramo }
}

# ---------------------------------------------------------------- CÉSPED
function MontarCesped($k){
    $f = Join-Path $raiz "Suelo/piezas/cesped.png"; $b = Cargar $f; $o = Bytes $b
    $arriba = $o.h; for ($y = 0; $y -lt $o.h -and $arriba -eq $o.h; $y += 2) { for ($x = 0; $x -lt $o.w; $x += 6) { if ($o.px[$y * $o.stride + $x * 4 + 3] -gt 128) { $arriba = $y; break } } }
    $y0 = [math]::Max(0, $arriba - 12)
    $a = Crop $b 0 $y0 $b.Width ($b.Height - $y0)
    $t = Lienzo ($a.Width * 2) $a.Height; $g = NewG $t
    Put $g $a 0 0; Put $g (Espejo $a) $a.Width 0; $g.Dispose()
    Write-Host "cesped: filas $y0..$($b.Height) (montado con su espejo: empalma consigo mismo)"
    GuardarEscalado $t $k (Join-Path $raiz "Suelo/tiras/cesped.png")
    @{ W = [math]::Round($t.Width * $k); H = [math]::Round($t.Height * $k) }
}

# ---------------------------------------------------------------- CIELO (nubes)
# Las nubes solo empalman arriba/abajo. Para la transición entre páginas el cielo se desplaza
# a los lados (parallax), así que se monta con su espejo al lado (A + A en espejo): empalma
# también a izquierda y derecha. El CSS lo muestra a 200vw (cada mitad = una pantalla).
function MontarCielo(){
    $f = Join-Path $raiz "Cielo/nubes.png"; if (-not (Test-Path $f)) { return }
    $b = Cargar $f
    $t = Lienzo ($b.Width * 2) $b.Height; $g = NewG $t
    Put $g $b 0 0; Put $g (Espejo $b) $b.Width 0; $g.Dispose()
    $dir = Join-Path $raiz "Cielo/tiras"; New-Item -ItemType Directory -Force $dir | Out-Null
    $t.Save((Join-Path $dir "nubes.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    "cielo: Cielo/tiras/nubes.png ($($t.Width) x $($t.Height), con su espejo: empalma a los lados)"

    # Nubes SUELTAS (sin el azul del cielo, fondo transparente): las capas de nubes que pasan
    # por delante en la transición entre páginas (parallax). El azul se quita por brillo:
    # lo que es tan oscuro como el cielo → transparente; las nubes → opacas; los bordes, a medias.
    $s = New-Object System.Drawing.Bitmap $t.Width, $t.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($s); $g.DrawImage($t, 0, 0, $t.Width, $t.Height); $g.Dispose()
    $cielo = $t.GetPixel(5, 5)
    [PfCielo]::QuitarFondo($s, $cielo.R, $cielo.G, $cielo.B, 30)
    $s.Save((Join-Path $dir "nubes-sueltas.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    "cielo: Cielo/tiras/nubes-sueltas.png (las mismas nubes, sin el cielo)"

    # MURO DE NUBES (transición lateral): tapa la pantalla mientras se cambia de sección.
    #   [ borde esponjoso | núcleo opaco (nubes apiladas) | borde esponjoso ]  · se repite hacia abajo
    # Se monta con las nubes enteras de nubes-sueltas.png. El núcleo es el 56% del ancho
    # (si se cambia, cambia también --transicion-muro-nucleo en Css/styles.css).
    $m = [PfCielo]::Muro($s, 3200, 2400, 0.56, 7, 233, 234, 247)
    $m.Save((Join-Path $dir "muro-nubes.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    "cielo: Cielo/tiras/muro-nubes.png ($($m.Width) x $($m.Height), núcleo 56%)"
}
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class PfCielo {
    // margen = cuánto más brillante que el cielo tiene que ser un píxel para ser nube del todo
    public static void QuitarFondo(Bitmap b, int r0, int g0, int b0, double margen) {
        var d = b.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        var px = new byte[d.Stride * b.Height]; Marshal.Copy(d.Scan0, px, 0, px.Length);
        double l0 = 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0;
        for (int i = 0; i < px.Length; i += 4) {
            double bl = px[i], gr = px[i + 1], rd = px[i + 2];
            double a = Math.Max(0, Math.Min(1, (0.2126 * rd + 0.7152 * gr + 0.0722 * bl - l0) / margen));
            if (a > 0 && a < 1) {   // borde: se quita la parte de azul que tenía mezclada
                rd = (rd - (1 - a) * r0) / a; gr = (gr - (1 - a) * g0) / a; bl = (bl - (1 - a) * b0) / a;
            }
            px[i] = (byte)Math.Max(0, Math.Min(255, bl)); px[i + 1] = (byte)Math.Max(0, Math.Min(255, gr));
            px[i + 2] = (byte)Math.Max(0, Math.Min(255, rd)); px[i + 3] = (byte)Math.Round(a * 255);
        }
        Marshal.Copy(px, 0, d.Scan0, px.Length); b.UnlockBits(d);
    }

    // Muro de nubes: W x H (se repite en vertical), núcleo = parte central opaca (fracción del ancho).
    // 1) Busca las nubes ENTERAS de src (manchas opacas que no tocan el borde) y las recorta.
    // 2) Rellena el núcleo del color de dentro de las nubes y le pone nubes encima (textura).
    // 3) Tapa la línea recta de cada lado del núcleo con nubes hasta que no quede ningún hueco:
    //    así el borde del muro es esponjoso. Todo se dibuja también desplazado ±H (empalma arriba/abajo).
    public static Bitmap Muro(Bitmap src, int W, int H, double nucleo, int semilla, int cr, int cg, int cb) {
        int f = 8, mw = src.Width / f, mh = src.Height / f;
        var d = src.LockBits(new Rectangle(0, 0, src.Width, src.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        var px = new byte[d.Stride * src.Height]; Marshal.Copy(d.Scan0, px, 0, px.Length); src.UnlockBits(d);
        var m = new bool[mw, mh];
        for (int y = 0; y < mh; y++) for (int x = 0; x < mw; x++) m[x, y] = px[(y * f + f / 2) * d.Stride + (x * f + f / 2) * 4 + 3] > 100;
        var visto = new bool[mw, mh];
        var etiqueta = new int[mw, mh];
        var nubes = new System.Collections.Generic.List<Bitmap>();
        var cola = new System.Collections.Generic.Queue<Point>();
        int actual = 0;
        for (int y0 = 0; y0 < mh; y0++) for (int x0 = 0; x0 < mw; x0++) {
            if (!m[x0, y0] || visto[x0, y0]) continue;
            int x1 = x0, x2 = x0, y1 = y0, y2 = y0, n = 0;
            actual++;
            visto[x0, y0] = true; cola.Enqueue(new Point(x0, y0));
            while (cola.Count > 0) {
                var p = cola.Dequeue(); n++; etiqueta[p.X, p.Y] = actual;
                x1 = Math.Min(x1, p.X); x2 = Math.Max(x2, p.X); y1 = Math.Min(y1, p.Y); y2 = Math.Max(y2, p.Y);
                foreach (var q in new[] { new Point(p.X + 1, p.Y), new Point(p.X - 1, p.Y), new Point(p.X, p.Y + 1), new Point(p.X, p.Y - 1) }) {
                    if (q.X < 0 || q.Y < 0 || q.X >= mw || q.Y >= mh || visto[q.X, q.Y] || !m[q.X, q.Y]) continue;
                    visto[q.X, q.Y] = true; cola.Enqueue(q);
                }
            }
            if (n < 30 || x1 == 0 || y1 == 0 || x2 == mw - 1 || y2 == mh - 1) continue;   // pequeña o cortada por el borde
            var r = Rectangle.Intersect(new Rectangle((x1 - 1) * f, (y1 - 1) * f, (x2 - x1 + 3) * f, (y2 - y1 + 3) * f), new Rectangle(0, 0, src.Width, src.Height));
            var nube = src.Clone(r, PixelFormat.Format32bppArgb);
            // Solo ESTA nube: lo que sea de otra nube que caiga dentro del recorte se borra
            var dn = nube.LockBits(new Rectangle(0, 0, nube.Width, nube.Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            var pn = new byte[dn.Stride * nube.Height]; Marshal.Copy(dn.Scan0, pn, 0, pn.Length);
            for (int yy = 0; yy < nube.Height; yy++) for (int xx = 0; xx < nube.Width; xx++) {
                int cx = (r.X + xx) / f, cy = (r.Y + yy) / f; bool mia = false;
                for (int oy = -1; oy <= 1 && !mia; oy++) for (int ox = -1; ox <= 1 && !mia; ox++) {
                    int qx = cx + ox, qy = cy + oy;
                    if (qx >= 0 && qy >= 0 && qx < mw && qy < mh && etiqueta[qx, qy] == actual) mia = true;
                }
                if (!mia) pn[yy * dn.Stride + xx * 4 + 3] = 0;
            }
            Marshal.Copy(pn, 0, dn.Scan0, pn.Length); nube.UnlockBits(dn);
            nubes.Add(nube);
        }
        if (nubes.Count == 0) throw new Exception("no hay nubes enteras en la imagen");

        var o = new Bitmap(W, H, PixelFormat.Format32bppArgb);
        var g = Graphics.FromImage(o);
        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
        int E = (int)Math.Round(W * (1 - nucleo) / 2);
        using (var pincel = new SolidBrush(Color.FromArgb(cr, cg, cb))) g.FillRectangle(pincel, E, 0, W - 2 * E, H);
        var rnd = new Random(semilla);
        Action<Bitmap, float, float, float> sello = (c, x, y, k) => {
            for (int dy = -1; dy <= 1; dy++) g.DrawImage(c, x, y + dy * H, c.Width * k, c.Height * k);
        };
        // Textura del núcleo
        for (int i = 0; i < 45; i++) {
            var c = nubes[rnd.Next(nubes.Count)]; float k = (float)(0.45 + rnd.NextDouble() * 0.5), w = c.Width * k;
            sello(c, (float)(E + rnd.NextDouble() * Math.Max(1, W - 2 * E - w)), (float)(rnd.NextDouble() * H), k);
        }
        // Bordes: nubes sobre la línea recta del núcleo hasta taparla entera
        for (int lado = 0; lado < 2; lado++) {
            int col = lado == 0 ? E - 2 : W - E + 1;
            for (int it = 0; it < 800; it++) {
                g.Flush();
                int hueco = -1;
                for (int y = 0; y < H; y += 3) if (o.GetPixel(col, y).A < 250) { hueco = y; break; }
                if (hueco < 0) break;
                var c = nubes[rnd.Next(nubes.Count)]; float k = (float)(0.4 + rnd.NextDouble() * 0.45), w = c.Width * k, h = c.Height * k;
                float x = (float)(col - w * (0.3 + rnd.NextDouble() * 0.4));
                x = Math.Max(0, Math.Min(W - w, x));
                sello(c, x, (float)(hueco - h * (0.35 + rnd.NextDouble() * 0.45)), k);
            }
            // y unas pocas sueltas por delante del borde
            for (int i = 0; i < 5; i++) {
                var c = nubes[rnd.Next(nubes.Count)]; float k = (float)(0.3 + rnd.NextDouble() * 0.3), w = c.Width * k;
                float x = lado == 0 ? (float)(rnd.NextDouble() * Math.Max(1, E - w * 0.6)) : (float)(W - E + rnd.NextDouble() * Math.Max(1, E - w * 0.6) - w * 0.4);
                sello(c, Math.Max(0, Math.Min(W - w, x)), (float)(rnd.NextDouble() * H), k);
            }
        }
        g.Dispose();
        foreach (var c in nubes) c.Dispose();
        return o;
    }
}
"@

# ---------------------------------------------------------------- HOJA DE FOTO (2º lado)
function RecortarLadoFoto(){
    foreach ($n in 2..9) {
        $f = Join-Path $raiz "Hojas/foto/lado-$n.png"; if (-not (Test-Path $f)) { continue }
        $b = Cargar $f; $c = Crop $b 666 1611 1795 440          # mismo recorte que recortes/lado-1.png
        $c.Save((Join-Path $raiz "Hojas/foto/recortes/lado-$n.png"), [System.Drawing.Imaging.ImageFormat]::Png)
        "hoja foto: recortes/lado-$n.png (1795 x 440)"
    }
}

# ---------------------------------------------------------------- todo
$tab = MontarTablonHorizontal (Join-Path $raiz "Cartel/tablon") "tablon" @(240, 520) 0.4
$pla = MontarTablonHorizontal (Join-Path $raiz "Cartel/placa")  "placa"  @(240, 520) 0.4
$pal = MontarPalo 0.25
$ces = MontarCesped 0.25
RecortarLadoFoto
MontarCielo

# ---------------------------------------------------------------- CSS generado
# Las medidas de cada variante (ancho de sus extremos, altos...) van a Css/decoracion-generada.css,
# que enlazan las páginas. Así no hay que copiar números a mano al cambiar las piezas.
$u = "../media/img/Deco"
$css = New-Object System.Text.StringBuilder
[void]$css.AppendLine("/* GENERADO por media/img/Deco/generar-decoracion.ps1 - no lo edites a mano: vuelve a ejecutar el script.")
[void]$css.AppendLine("   Medidas en px de las IMAGENES (el tamano en pantalla lo decide Css/styles.css). */")
[void]$css.AppendLine(":root{")
foreach ($v in $tab.variantes) { [void]$css.AppendLine("    --cartel-tablon-$($v.n): url(""$u/Cartel/tablon/tiras/tablon-$($v.n).png"");") }
[void]$css.AppendLine("    --cartel-tablon-alto-img: $($tab.H);")
foreach ($v in $pla.variantes) { [void]$css.AppendLine("    --cartel-placa-$($v.n): url(""$u/Cartel/placa/tiras/placa-$($v.n).png"");") }
[void]$css.AppendLine("    --cartel-placa-alto-img: $($pla.H);")
foreach ($n in 1..$pal.n) { [void]$css.AppendLine("    --palo-punta-${n}: url(""$u/Palo/tiras/punta-$n.png"");") }
[void]$css.AppendLine("    --palo-tramo: url(""$u/Palo/tiras/tramo.png"");")
[void]$css.AppendLine("    --palo-ancho-img: $($pal.W);")
[void]$css.AppendLine("    --palo-punta-alto-img: $($pal.HP);")
[void]$css.AppendLine("    --palo-tramo-alto-img: $($pal.HT);")
[void]$css.AppendLine("    --suelo-img: url(""$u/Suelo/tiras/cesped.png"");")
[void]$css.AppendLine("    --suelo-ancho-img: $($ces.W);")
[void]$css.AppendLine("    --suelo-alto-img: $($ces.H);")
[void]$css.AppendLine("}")
[void]$css.AppendLine("/* Ancho (px de la imagen) del extremo izquierdo y derecho de cada variante */")
foreach ($v in $tab.variantes) { [void]$css.AppendLine(".pf-cartel-tablon[data-v=""$($v.n)""]{ --_img: var(--cartel-tablon-$($v.n)); --_izq: $($v.izq); --_der: $($v.der); }") }
foreach ($v in $pla.variantes) { [void]$css.AppendLine(".pf-placa[data-v=""$($v.n)""]{ --_img: var(--cartel-placa-$($v.n)); --_izq: $($v.izq); --_der: $($v.der); }") }
foreach ($n in 1..$pal.n) { [void]$css.AppendLine(".pf-palo-punta[data-v=""$n""]{ background-image: var(--palo-punta-$n); }") }
$rutaCss = Join-Path $raiz "../../../Css/decoracion-generada.css"
[IO.File]::WriteAllText([IO.Path]::GetFullPath($rutaCss), $css.ToString(), (New-Object System.Text.UTF8Encoding $false))
""
"Escrito Css/decoracion-generada.css: $($tab.variantes.Count) tablones, $($pla.variantes.Count) placas, $($pal.n) puntas de palo"
