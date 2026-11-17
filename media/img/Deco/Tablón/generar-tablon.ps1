# Monta las dos tiras de una VARIANTE de tablón a partir de 3 dibujos (lienzo de cualquier tamaño,
# fondo transparente, tablones horizontales con su línea negra):
#   -esquina  esquina de ARRIBA-IZQUIERDA con el borde de arriba a su derecha (y al menos 1 junta debajo)
#   -lado     lado IZQUIERDO con al menos 3 juntas entre tablones
#   -medio    tablones del centro con al menos 3 juntas
# Salida (siempre del mismo tamaño, para que todas las variantes encajen entre sí):
#   tablon-borde<N>.png  = franja de ARRIBA  (esquina | borde | esquina)  1500 x 349
#   tablon-centro<N>.png = 1 TABLÓN central  (lado | medio | lado)        1500 x 690
# La derecha es el espejo de la izquierda; el borde de abajo lo voltea el CSS.
# Las medidas (grosor del lado, alto de un tablón...) se DETECTAN solas buscando las juntas negras.
#
# Uso (desde la raíz del proyecto):
#   $d = (Resolve-Path "media/img/Deco/Tablón").Path
#   & "$d/generar-tablon.ps1" -dir $d -n 2 -esquina "Tablon-esquina2" -lado "Tablon-borde2" -medio "Tablon-centro2"
# Luego en Css/styles.css: --tablon-img-borde-2 y --tablon-img-centro-2 apuntando a los PNG generados.
# Opcional: -preview "$env:TEMP/tablon-preview.png" guarda un tablón de muestra.
# (La variante 1 se montó con una versión anterior de este script, a partir de
#  Esquina2 + Centro superior-interior + Centro de lados + Medio: ver historial de git.)
param(
    [Parameter(Mandatory)][string]$dir, [Parameter(Mandatory)][string]$n,
    [Parameter(Mandatory)][string]$esquina, [Parameter(Mandatory)][string]$lado, [Parameter(Mandatory)][string]$medio,
    [string]$preview = ""
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

# Medidas de salida (= --tablon-img-borde / --tablon-img-lado / --tablon-img-tablon del CSS)
$OUT_W = 1500; $OUT_S = 150; $OUT_TH = 349; $OUT_P = 690
$OUT_CW = $OUT_W - 2 * $OUT_S

function Cargar($nombre) {
    $b = New-Object System.Drawing.Bitmap (Join-Path $dir "$nombre.png"); $b.SetResolution(96,96)
    $r = New-Object System.Drawing.Rectangle 0,0,$b.Width,$b.Height
    $d = $b.LockBits($r, 'ReadOnly', 'Format32bppArgb')
    $px = New-Object byte[] ($d.Stride * $b.Height)
    [Runtime.InteropServices.Marshal]::Copy($d.Scan0, $px, 0, $px.Length); $b.UnlockBits($d)
    $o = [pscustomobject]@{ bmp = $b; px = $px; stride = $d.Stride; w = $b.Width; h = $b.Height }
    # Caja del dibujo (píxeles opacos)
    $x0 = $o.w; $y0 = $o.h; $x1 = 0; $y1 = 0
    for ($y = 0; $y -lt $o.h; $y += 2) { for ($x = 0; $x -lt $o.w; $x += 2) {
        if ($px[$y * $o.stride + $x * 4 + 3] -gt 128) {
            if ($x -lt $x0) { $x0 = $x }; if ($x -gt $x1) { $x1 = $x }; if ($y -lt $y0) { $y0 = $y }; if ($y -gt $y1) { $y1 = $y } } } }
    $o | Add-Member x0 $x0; $o | Add-Member y0 $y0; $o | Add-Member x1 $x1; $o | Add-Member y1 $y1
    $o
}
# Filas donde EMPIEZA cada línea negra en la columna x
function Lineas($o, $x) {
    $r = @(); $prev = $false
    for ($y = $o.y0; $y -le $o.y1; $y++) {
        $i = $y * $o.stride + $x * 4
        $neg = $o.px[$i + 3] -gt 128 -and $o.px[$i + 2] -lt 80 -and $o.px[$i + 1] -lt 80
        if ($neg -and -not $prev) { $r += $y }; $prev = $neg
    }
    # Une líneas casi pegadas (un trazo con un hueco de 1-2 px)
    $f = @(); foreach ($y in $r) { if (-not $f.Count -or $y - $f[-1] -gt 20) { $f += $y } }
    ,$f
}
function Medio([int[]]$a, $i) { [int](($a[$i] + $a[$i + 1]) / 2) }

$E = Cargar $esquina; $L = Cargar $lado; $M = Cargar $medio

# --- Juntas y alto de un tablón ---
$jm = Lineas $M ([int](($M.x0 + $M.x1) / 2))
$jl = Lineas $L ([int](($L.x0 + $L.x1) / 2))
if ($jm.Count -lt 3) { throw "En '$medio' hacen falta al menos 3 juntas (hay $($jm.Count))" }
if ($jl.Count -lt 3) { throw "En '$lado' hacen falta al menos 3 juntas (hay $($jl.Count))" }
$P = ($jm[$jm.Count - 1] - $jm[0]) / ($jm.Count - 1)          # alto medio de un tablón (px del dibujo)
$f = $OUT_P / $P                                              # escala dibujo → salida
$S = [int][math]::Round($OUT_S / $f)                          # ancho de la columna del lado (px del dibujo)

# Esquina: línea de arriba y primera junta, medidas un poco a la derecha de la esquina
$je = Lineas $E ([int]($E.x0 + 4 * $S))
if ($je.Count -lt 2) { throw "En '$esquina' hace falta la línea de arriba y al menos 1 junta" }
$eY0 = [math]::Max(0, $E.y0 - 1)
$mg = [int]($S / 3)                                           # margen para no coger el borde recto del lienzo

# Borde izquierdo del dibujo en la fila y (relativo a la caja del dibujo)
function BordeIzq($o, $y) {
    for ($x = $o.x0; $x -lt $o.x0 + 3 * $S; $x++) { if ($o.px[$y * $o.stride + $x * 4 + 3] -gt 128) { return $x - $o.x0 } }
    3 * $S
}
# Fila donde empieza la línea negra en la columna x, buscando cerca de "cerca"
function LineaEn($o, $x, $cerca) {
    $r = [int]($P / 3); $mejor = $null
    for ($y = [math]::Max($o.y0, $cerca - $r); $y -le [math]::Min($o.y1, $cerca + $r); $y++) {
        $i = $y * $o.stride + $x * 4
        if ($o.px[$i + 3] -gt 128 -and $o.px[$i + 2] -lt 80 -and $o.px[$i + 1] -lt 80) {
            if ($null -eq $mejor -or [math]::Abs($y - $cerca) -lt [math]::Abs($mejor - $cerca)) { $mejor = $y }
            while ($y -le $o.y1 -and $o.px[$y * $o.stride + $x * 4 + 2] -lt 80) { $y++ }   # salta el grosor del trazo
        }
    }
    if ($null -eq $mejor) { $cerca } else { $mejor }
}

# --- Cortes del LADO: el dibujo no es recto, así que se corta donde el borde izquierdo
#     coincide arriba y abajo (si no, al repetir el tablón se ve un escalón) ---
$xl = @{}; for ($y = $jl[0]; $y -le $jl[2]; $y++) { $xl[$y] = BordeIzq $L $y }
$pend = { param($t, $y) [math]::Abs($t[$y + 4] - $t[$y - 4]) }
$mejor = $null
$ma = ($jl[0] + $jl[1]) / 2; $mb = ($jl[1] + $jl[2]) / 2; $tol = 0.15 * $P     # cortes cerca de la MITAD del tablón (todas las variantes combinan)
for ($a = [int]($ma - $tol); $a -le [int]($ma + $tol); $a += 2) {
    for ($b = [int]($mb - $tol); $b -le [int]($mb + $tol); $b += 2) {
        $c = 3 * [math]::Abs($xl[$a] - $xl[$b]) + (& $pend $xl $a) + (& $pend $xl $b) + 0.15 * [math]::Abs(($b - $a) - $P)
        if ($null -eq $mejor -or $c -lt $mejor[0]) { $mejor = @($c, $a, $b) }
    }
}
$lY0 = $mejor[1]; $lY1 = $mejor[2]; $xCorte = ($xl[$lY0] + $xl[$lY1]) / 2

# --- Corte de la ESQUINA (fin de la franja de arriba): mismo borde izquierdo que el lado,
#     y cerca de la mitad del primer tablón (como en el resto de variantes) ---
$xe = @{}; for ($y = $je[0]; $y -le $je[1]; $y++) { $xe[$y] = BordeIzq $E $y }
$ideal = ($je[0] + $je[1]) / 2; $mejor = $null
for ($y = [int]($ideal - $tol); $y -le [int]($ideal + $tol); $y++) {
    $c = 3 * [math]::Abs($xe[$y] - $xCorte) + (& $pend $xe $y) + 0.1 * [math]::Abs($y - $ideal)
    if ($null -eq $mejor -or $c -lt $mejor[0]) { $mejor = @($c, $y) }
}
$eYC = $mejor[1]

# --- Fin del BORDE de arriba: donde la línea de arriba está a la misma altura que junto a la
#     esquina (la esquina de la derecha es el espejo de la izquierda) ---
$xs = $E.x0 - 1 + $S
$tIzq = LineaEn $E $xs $je[0]; $mejor = $null
for ($x = [int]($xs + 0.6 * ($E.x1 - $mg - $xs)); $x -le $E.x1 - $mg; $x += 2) {
    $c = [math]::Abs((LineaEn $E $x $je[0]) - $tIzq) - 0.002 * $x
    if ($null -eq $mejor -or $c -lt $mejor[0]) { $mejor = @($c, $x) }
}
$eXFin = $mejor[1]

# --- Ventana del MEDIO: misma posición relativa de la junta que en el lado, y extremos
#     izquierdo/derecho donde la junta está a la misma altura ---
$jLado = LineaEn $L ($L.x0 - 1 + $S) $jl[1]
$frac = ($jLado - $lY0) / ($lY1 - $lY0)
$mIni = $M.x0 + $mg; $mejor = $null
for ($x = [int]($M.x1 - $mg - 0.4 * ($M.x1 - $M.x0)); $x -le $M.x1 - $mg; $x += 2) {
    $c = [math]::Abs((LineaEn $M $x $jm[1]) - (LineaEn $M $mIni $jm[1])) - 0.002 * $x
    if ($null -eq $mejor -or $c -lt $mejor[0]) { $mejor = @($c, $x) }
}
$mFin = $mejor[1]
$hM = $lY1 - $lY0
$mY0 = [int]((LineaEn $M $mIni $jm[1]) - $frac * $hM); $mY1 = $mY0 + $hM

"Detectado: tablón = $([int]$P) px, lado = $S px, escala x$([math]::Round($f, 2))"
"Cortes: esquina $eY0..$eYC (hasta x=$eXFin) · lado $lY0..$lY1 · medio $mY0..$mY1 (x $mIni..$mFin)"

function Nuevo($w, $h) {
    $b = New-Object System.Drawing.Bitmap $w, $h; $b.SetResolution(96,96)
    $g = [System.Drawing.Graphics]::FromImage($b)
    $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingMode = 'SourceCopy'
    ,@($b, $g)
}
$attr = New-Object System.Drawing.Imaging.ImageAttributes; $attr.SetWrapMode('TileFlipXY')   # sin halos en los cortes
function Poner($g, $src, $sx, $sy, $sw, $sh, $dx, $dy, $dw, $dh) {
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle $dx, $dy, $dw, $dh), $sx, $sy, $sw, $sh, [System.Drawing.GraphicsUnit]::Pixel, $attr)
}
function ConEspejo($bmp, $hh) {   # copia la columna izquierda (0..OUT_S) volteada a la derecha
    $iz = $bmp.Clone((New-Object System.Drawing.Rectangle 0, 0, $OUT_S, $hh), $bmp.PixelFormat); $iz.RotateFlip('RotateNoneFlipX')
    $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CompositingMode = 'SourceCopy'
    $g.DrawImage($iz, $OUT_W - $OUT_S, 0, $OUT_S, $hh); $g.Dispose()
}

# --- Borde (franja de arriba) ---
$eX = $E.x0 - 1
$t = Nuevo $OUT_W $OUT_TH; $top = $t[0]; $g = $t[1]
Poner $g $E.bmp $eX $eY0 $S ($eYC - $eY0) 0 0 $OUT_S $OUT_TH                                       # esquina
Poner $g $E.bmp ($eX + $S) $eY0 ($eXFin - $eX - $S) ($eYC - $eY0) $OUT_S 0 $OUT_CW $OUT_TH          # borde de arriba
$g.Dispose(); ConEspejo $top $OUT_TH
$top.Save((Join-Path $dir "tablon-borde$n.png"), [System.Drawing.Imaging.ImageFormat]::Png)

# --- Centro (1 tablón) ---
$t = Nuevo $OUT_W $OUT_P; $mid = $t[0]; $g = $t[1]
Poner $g $L.bmp ($L.x0 - 1) $lY0 $S ($lY1 - $lY0) 0 0 $OUT_S $OUT_P                                 # lado
Poner $g $M.bmp $mIni $mY0 ($mFin - $mIni) ($mY1 - $mY0) $OUT_S 0 $OUT_CW $OUT_P                   # medio
$g.Dispose(); ConEspejo $mid $OUT_P
$mid.Save((Join-Path $dir "tablon-centro$n.png"), [System.Drawing.Imaging.ImageFormat]::Png)

# --- Vista previa opcional (borde + 3 tablones + borde volteado) ---
if ($preview) {
    $bot = $top.Clone(); $bot.RotateFlip('RotateNoneFlipY')
    $pv = New-Object System.Drawing.Bitmap $OUT_W, ($OUT_TH * 2 + $OUT_P * 3); $pv.SetResolution(96,96)
    $g = [System.Drawing.Graphics]::FromImage($pv); $g.Clear([System.Drawing.Color]::FromArgb(255, 176, 178, 220))
    $g.DrawImage($top, 0, 0); for ($i = 0; $i -lt 3; $i++) { $g.DrawImage($mid, 0, $OUT_TH + $i * $OUT_P) }; $g.DrawImage($bot, 0, $OUT_TH + 3 * $OUT_P)
    $g.Dispose(); $pv.Save($preview, [System.Drawing.Imaging.ImageFormat]::Png)
}
"OK variante $n -> tablon-borde$n.png ($OUT_W x $OUT_TH) y tablon-centro$n.png ($OUT_W x $OUT_P)"
